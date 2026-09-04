import debug from 'debug'
import WebSocket from 'ws'

import { get_base_session_token } from '#libs-server/data-views/generation/base-session-client.mjs'

const log = debug('data-views:generation-timeline-subscription')

// Near-real-time delivery of a generation thread's timeline, from base to
// league. The browser cannot reach base, so league subscribes on its behalf and
// relays onto its own generation socket.
//
// THIS IS AN OPTIMIZATION OVER A CORRECT BASELINE, NEVER THE SOURCE OF TRUTH.
// The REST backfill in generation-timeline-backfill.mjs is what makes the panel
// correct; this only makes it prompt. If this module never connects, a user sees
// the timeline advance on attach instead of live, and the collector still
// records terminal state and trajectory. Nothing here may become load-bearing
// without moving that guarantee somewhere else first.
//
// OWNED BY THE JOB LIFECYCLE, NOT BY THE BROWSER CONNECTION. The drainer opens
// this when it stamps `thread_id` and closes it at terminal status. If a browser
// refresh tore it down and re-established it, entries emitted in between would
// be lost from the live tail -- and the whole point of `since_index` is that
// there is no such gap.
//
// SUBSCRIPTION IS WHAT MAKES ENTRIES FULL. Base serves an UNSUBSCRIBED socket a
// truncated form -- `{id, type, role, truncated: true, ordering, timestamp}`
// with content capped at 240 characters, batched at 200ms per thread with
// last-write-wins, so intermediate entries are dropped outright. A client that
// merely connects and listens gets a plausible-looking stream that is missing
// most of the run. Hence SUBSCRIBE_THREAD rather than a bare connection.

// Backoff between reconnects. Capped so a base restart is recovered from in
// seconds rather than minutes, and jittered so several concurrent generations
// do not retry in lockstep.
const INITIAL_BACKOFF_MS = 500
const MAX_BACKOFF_MS = 15 * 1000

/**
 * The websocket URL for base, derived from the REST base URL.
 *
 * Base authenticates the UPGRADE with a `token` query parameter and rejects an
 * unauthenticated handshake with a 401 -- there is no header to set, because
 * the browser WebSocket API cannot send one and base's handler is shared.
 *
 * @param {string} base_url
 * @param {string} token
 * @returns {string}
 */
export const build_subscription_url = (base_url, token) => {
  const url = new URL(base_url.replace(/\/$/, ''))
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', token)
  return url.toString()
}

/**
 * Subscribe to one generation thread's timeline and relay its entries.
 *
 * Returns a handle with a `close()`. The caller owns the lifetime; nothing here
 * stops on its own, because "the run ended" is a fact league holds on its job
 * row and base's socket has no reason to volunteer it.
 *
 * @param {object} params
 * @param {string} params.thread_id
 * @param {(entry: object) => void} params.on_entry - called per timeline entry
 * @param {number} [params.since_index] - resume point; entries past it replay
 * @param {number|null} [params.epoch] - cached ordering epoch, for re-rank
 *   detection
 * @param {new (url: string) => object} [params.socket_impl] - injected by the
 *   spec
 * @param {() => Promise<string>} [params.read_token] - injected by the spec
 * @returns {{close: () => void, get_since_index: () => number}}
 */
export const subscribe_to_generation_timeline = ({
  thread_id,
  on_entry,
  since_index = -1,
  epoch = null,
  socket_impl = WebSocket,
  read_token = get_base_session_token
}) => {
  let socket = null
  let closed = false
  let backoff_ms = INITIAL_BACKOFF_MS
  let reconnect_timer = null
  // Advanced on every entry relayed, so a reconnect asks only for the gap.
  // Held here rather than passed back in by the caller: the caller cannot know
  // what arrived between its last read and the drop.
  let last_index = since_index
  let current_epoch = epoch

  const send_subscribe = () => {
    socket.send(
      JSON.stringify({
        type: 'SUBSCRIBE_THREAD',
        payload: {
          thread_id,
          // Re-sent on EVERY open, not only the first. A reconnect with no
          // cursor would replay the whole run or none of it, and both are
          // wrong: the first double-renders and the second leaves a hole.
          since_index: last_index,
          ...(current_epoch === null ? {} : { epoch: current_epoch })
        }
      })
    )
  }

  const handle_message = (raw) => {
    let message
    try {
      message = JSON.parse(raw.toString())
    } catch {
      return
    }

    if (message?.type === 'SUBSCRIPTION_DENIED') {
      // Loud, because this is the failure that would otherwise look like a
      // quiet run. The subscription path REFUSES outright where the REST path
      // masks, so this is the one signal that says the read is unauthorized
      // rather than uneventful.
      log('base DENIED the subscription to thread %s', thread_id)
      return
    }

    if (message?.type === 'THREAD_TIMELINE_RESYNC') {
      // Base re-ranked the timeline, so every index held here is stale. Reset
      // the cursor and let the next attach's backfill re-establish truth
      // rather than stitching a scrambled tail.
      log('thread %s re-ranked; resetting the cursor', thread_id)
      last_index = -1
      current_epoch = message?.payload?.epoch ?? null
      return
    }

    if (message?.type !== 'THREAD_TIMELINE_ENTRY_ADDED') return
    if (message?.payload?.thread_id !== thread_id) return

    const entry = message.payload.entry
    if (!entry) return

    const index = entry?.ordering?.timeline_index
    if (Number.isFinite(index)) {
      // Out-of-order and duplicate entries are both real: a replay overlaps the
      // live tail by construction. Dropping anything at or behind the cursor
      // here means the relay downstream never has to.
      if (index <= last_index) return
      last_index = index
    }
    if (Number.isFinite(entry?.ordering?.timeline_epoch)) {
      current_epoch = entry.ordering.timeline_epoch
    }

    try {
      on_entry(entry)
    } catch (error) {
      log('entry handler threw for %s: %s', thread_id, error.message)
    }
  }

  const connect = async () => {
    if (closed) return

    let token
    try {
      token = await read_token()
    } catch (error) {
      log('could not mint a token for %s: %s', thread_id, error.message)
      schedule_reconnect()
      return
    }

    if (closed) return

    try {
      // Aliased to a capitalized binding because it IS a constructor, and
      // `new socket_impl(...)` reads as a function call to both the linter
      // and a human.
      const SocketConstructor = socket_impl
      socket = new SocketConstructor(
        build_subscription_url(process.env.BASE_API_URL, token)
      )
    } catch (error) {
      log('socket construction failed for %s: %s', thread_id, error.message)
      schedule_reconnect()
      return
    }

    socket.on('open', () => {
      // Reset only once the connection is UP. Resetting on attempt would turn a
      // base that accepts and immediately drops into a tight retry loop.
      backoff_ms = INITIAL_BACKOFF_MS
      send_subscribe()
    })
    socket.on('message', handle_message)
    socket.on('error', (error) =>
      log('subscription error for %s: %s', thread_id, error.message)
    )
    socket.on('close', () => {
      socket = null
      schedule_reconnect()
    })
  }

  const schedule_reconnect = () => {
    if (closed || reconnect_timer) return
    const jitter = Math.floor(Math.random() * (backoff_ms / 2))
    reconnect_timer = setTimeout(() => {
      reconnect_timer = null
      connect().catch((error) =>
        log('reconnect failed for %s: %s', thread_id, error.message)
      )
    }, backoff_ms + jitter)
    backoff_ms = Math.min(backoff_ms * 2, MAX_BACKOFF_MS)
  }

  connect().catch((error) =>
    log('initial connect failed for %s: %s', thread_id, error.message)
  )

  return {
    close: () => {
      closed = true
      if (reconnect_timer) {
        clearTimeout(reconnect_timer)
        reconnect_timer = null
      }
      if (socket) {
        try {
          socket.close()
        } catch {
          // Already gone. Closing a dead socket is not an error worth raising
          // from a teardown that runs after the job is finished.
        }
        socket = null
      }
    },
    get_since_index: () => last_index
  }
}

// The live feeds currently open, keyed by generation_id.
//
// IN-PROCESS IS SOUND HERE AND IT IS WORTH SAYING WHY, because it would not be
// in a different topology: the drainer runs INSIDE the API process
// (`server.mjs` starts it and says so), so the job lifecycle that opens a feed
// and the socket that reads it are the same process. A drainer moved to its own
// worker would need a real bus, and this Map would silently serve nobody --
// which is the shape this whole chain exists to stop happening.
const feeds = new Map()

/**
 * Open the live feed for a generation. Called by the drainer at `thread_id`.
 *
 * Idempotent: a second call for a generation already fed is a no-op rather than
 * a second socket against the same thread.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @param {string} params.thread_id
 * @param {(params: {thread_id: string, on_entry: (entry: object) => void})
 *   => {close: () => void}} [params.subscribe] - injected by the spec
 * @returns {{opened: boolean}}
 */
export const open_generation_timeline_feed = ({
  generation_id,
  thread_id,
  subscribe = subscribe_to_generation_timeline
}) => {
  if (feeds.has(generation_id)) return { opened: false }

  const listeners = new Set()
  const feed = { listeners, subscription: null }
  // Registered BEFORE subscribing, so an entry arriving synchronously during
  // subscribe has somewhere to land.
  feeds.set(generation_id, feed)

  feed.subscription = subscribe({
    thread_id,
    on_entry: (entry) => {
      for (const listener of listeners) {
        try {
          listener(entry)
        } catch (error) {
          // One browser's dead socket must not stop delivery to the others.
          log('listener threw for %s: %s', generation_id, error.message)
        }
      }
    }
  })

  return { opened: true }
}

/**
 * Close a generation's live feed. Called at terminal status.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @returns {{closed: boolean}}
 */
export const close_generation_timeline_feed = ({ generation_id }) => {
  const feed = feeds.get(generation_id)
  if (!feed) return { closed: false }
  feed.listeners.clear()
  feed.subscription?.close()
  feeds.delete(generation_id)
  return { closed: true }
}

/**
 * Listen to a generation's live entries. Returns its own unsubscribe.
 *
 * Returns a no-op unsubscribe when no feed is open, which is the ordinary case
 * for a job still `queued` and for one that finished before this socket
 * attached. Neither is an error: the backfill is what makes those correct.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @param {(entry: object) => void} params.listener
 * @returns {() => void}
 */
export const add_generation_timeline_listener = ({
  generation_id,
  listener
}) => {
  const feed = feeds.get(generation_id)
  if (!feed) return () => {}
  feed.listeners.add(listener)
  return () => feed.listeners.delete(listener)
}

/**
 * Whether a feed is open. Exported for the spec and for the drainer's
 * idempotence check.
 *
 * @param {string} generation_id
 * @returns {boolean}
 */
export const has_generation_timeline_feed = (generation_id) =>
  feeds.has(generation_id)

export default {
  add_generation_timeline_listener,
  build_subscription_url,
  close_generation_timeline_feed,
  has_generation_timeline_feed,
  open_generation_timeline_feed,
  subscribe_to_generation_timeline
}
