import debug from 'debug'

import {
  get_base_session_token,
  reset_base_session_token,
  BaseSessionError
} from '#libs-server/data-views/generation/base-session-client.mjs'

const log = debug('data-views:generation-timeline-backfill')

// The durable read behind every attach: first load, refresh, socket reconnect,
// league API restart. All four run this one path, so refresh stops being a
// special case and there is no separate resume path that can rot.
//
// THE SOCKET CARRIES LIVENESS, THIS CARRIES TRUTH. Correctness never depends on
// the subscription. If it drops, the next attach closes the gap.
//
// WHY THIS IS NOT THE COLLECTOR'S CALL. generation-collector.mjs reads the same
// endpoint with `timeline_limit=0`, and that zero is a COST choice documented at
// its own call site, not a permission one. The collector runs every 5 seconds
// against every live job; making it pull a transcript on every pass would be the
// most expensive thing the generation path does. So the cheap terminal-state
// poll and the timeline read stay separate calls with separate limits.
//
// LEAGUE READS THESE THREADS AS THEIR OWNER, and that is the whole access
// story. base-session-client mints a session token for the
// `league-data-view-generation` identity, which is the `user_public_key` on
// every generation thread. Ownership short-circuits base's read decision before
// compartments are consulted, so the `PRIVATE` compartment floor these threads
// sit on never applies to this caller. No share token is involved.

const REQUEST_TIMEOUT_MS = 30 * 1000

// How many entries an attach pulls for the collapsed row. Small on purpose: the
// panel shows ONE event until the user expands it, and a fifteen-minute run must
// not dump its history on every reload.
export const DEFAULT_TAKE_LAST = 25

// The ceiling on one expansion page. Expansion walks backward with
// `before_index` rather than asking for everything, because the 15-minute
// worst case has never been measured and an unbounded read is the kind of thing
// that is fine until the one run where it is not.
export const MAX_PAGE_SIZE = 200

/**
 * Stamp the envelope's redaction flag onto every entry.
 *
 * THIS IS LOAD-BEARING AND IT IS NOT DEFENSIVE TIDYING. Base's `is_redacted` is
 * an ENVELOPE-level marker -- it lives on the top-level thread object and is
 * deliberately NOT set on nested sub-objects (base's own
 * `system/text/permission-system-design.md` says so in as many words). The
 * shared timeline component renders an entry as masked only when the ENTRY
 * carries `is_redacted`, so without this mapping that branch is unreachable and
 * a permission failure paints block characters into the panel as though they
 * were the agent's own words.
 *
 * Measured 2026-09-04 against a real generation thread: an unauthenticated read
 * returns 200 with the same entry count, the same type histogram and the same
 * content LENGTHS as the authenticated one, and zero entries carrying
 * `is_redacted`. Nothing about the shape distinguishes the two.
 *
 * @param {Array<object>} entries
 * @param {boolean} is_redacted - the envelope flag
 * @returns {Array<object>}
 */
export const apply_envelope_redaction = (entries, is_redacted) => {
  if (!is_redacted) return entries
  return entries.map((entry) => ({ ...entry, is_redacted: true }))
}

/**
 * Read a slice of a generation thread's timeline off base.
 *
 * @param {object} params
 * @param {string} params.thread_id
 * @param {number} [params.take_last] - the tail size for an attach
 * @param {number|null} [params.before_index] - page backward from this index
 * @param {(url: string, init: object) => Promise<Response>} [params.fetch_impl]
 * @param {() => Promise<string>} [params.read_token] - injected by the spec
 * @returns {Promise<{entries: Array<object>, timeline_window: object|null,
 *   is_redacted: boolean}>}
 */
export const read_generation_timeline = async ({
  thread_id,
  take_last = DEFAULT_TAKE_LAST,
  before_index = null,
  fetch_impl = fetch,
  read_token = get_base_session_token
}) => {
  const base_url = process.env.BASE_API_URL
  if (!base_url) {
    throw new BaseSessionError(
      'base_api_url_unset',
      'BASE_API_URL is not set, so there is no base rail to read a generation timeline from'
    )
  }

  const limit = Math.min(Math.max(1, take_last), MAX_PAGE_SIZE)

  // POSITION-BASED SLICING ONLY, and never `timeline_limit`. Base sorts its
  // slice parameters into three mutually exclusive groups -- pagination
  // (`limit`/`offset`, which `timeline_limit` feeds), position-based
  // (`take_last` and friends) and index-based -- and refuses any request
  // touching two of them with a 500 (`timeline-filter-utils.mjs`). Sending
  // `timeline_limit` alongside `take_last` was that refusal on EVERY attach,
  // and pairing it with `before_index` is rejected by a separate branch, so
  // both halves of this read were broken against real base.
  //
  // `take_last` is also the only one that answers the question an attach is
  // asking. `timeline_limit` alone returns the HEAD of the timeline, so the
  // collapsed row would show a run's FIRST event under the label "latest".
  const params = new URLSearchParams()
  params.set('take_last', String(limit))
  if (Number.isFinite(before_index)) {
    params.set('before_index', String(before_index))
  }

  const url = `${base_url.replace(/\/$/, '')}/api/threads/${thread_id}?${params}`

  const get = async (token) =>
    fetch_impl(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

  let response = await get(await read_token())
  // Same one-retry-on-401 as every other base call in this directory: a rotated
  // identity key invalidates every token base ever issued, and a cached one
  // outlives its identity.
  if (response.status === 401) {
    reset_base_session_token()
    response = await get(await read_token({ force: true }))
  }

  if (response.status === 404) {
    return { entries: [], timeline_window: null, is_redacted: false }
  }

  if (!response.ok) {
    const text = await response.text()
    throw new BaseSessionError(
      'base_timeline_unreadable',
      `base refused a timeline read with ${response.status}: ${text.slice(0, 200)}`,
      { status: response.status }
    )
  }

  const body = await response.json()
  const is_redacted = Boolean(body?.is_redacted)

  if (is_redacted) {
    // Worth a line in the log precisely because it does not look like a
    // failure anywhere else: the response was a 200 with the right shape.
    log('timeline read for %s came back REDACTED', thread_id)
  }

  return {
    entries: apply_envelope_redaction(body?.timeline ?? [], is_redacted),
    timeline_window: body?.timeline_window ?? null,
    is_redacted
  }
}

export default {
  DEFAULT_TAKE_LAST,
  MAX_PAGE_SIZE,
  apply_envelope_redaction,
  read_generation_timeline
}
