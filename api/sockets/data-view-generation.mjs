import debug from 'debug'

import db from '#db'
import {
  enqueue_generation_job,
  get_generation_job,
  get_queue_depth,
  resolve_principal_key,
  GenerationQueueError,
  MAX_QUEUE_DEPTH,
  LIVE_STATUSES
} from '#libs-server/data-views/generation/generation-job-queue.mjs'
import { assert_generation_admissible } from '#libs-server/data-views/generation/generation-limits.mjs'
import { read_generation_progress } from '#libs-server/data-views/generation/generation-progress.mjs'
import { send_websocket_message } from './utils.mjs'

const log = debug('data-view-generation-socket')

// Socket delivery for agentic data view generation.
//
// ASYNCHRONOUS BY CONSTRUCTION. A container REPL plus an agent loop runs in
// MINUTES, so a held-open request is the wrong shape and the socket relays a
// run it only observes. The client gets an opaque generation_id immediately and
// the finished view whenever it arrives.
//
// THE ID IS THE WHOLE CONTRACT, and it is deliberately not the user. A client
// that closes its laptop mid-run comes back holding only the generation_id and
// collects the result it did not wait for -- and that same property is the
// entirety of what anonymous delivery needs later. Authentication is an
// ADMISSION CHECK layered on top (see require_generation_principal), never a
// key anything structural is stored under, so opening generation up is deleting
// a check rather than re-keying live rows.

// How often a watching socket asks the job row whether anything moved. The row
// is the authority; nothing pushes to this process, because the agent runs in a
// container on another host and league only sees what the drainer wrote.
const POLL_INTERVAL_MS = 2000

// Sockets currently watching a generation, per connection. Held so a close can
// stop the polling -- which stops the POLLING ONLY. The run itself continues to
// its own deadline, because a disconnect must not cancel a job the client can
// still come back for; "the client went away" and "the run should stop" are
// different events and only the second one ends a run.
const socket_watchers = new WeakMap()

const get_watchers = (ws) => {
  let watchers = socket_watchers.get(ws)
  if (!watchers) {
    watchers = new Map()
    socket_watchers.set(ws, watchers)
  }
  return watchers
}

/**
 * The public shape of a job. Never the whole row.
 *
 * principal_key and user_id are withheld deliberately: the first is a
 * rate-limit key that would let one caller enumerate another's address, and the
 * second is attribution the client already knows about itself. The trajectory
 * fields ARE included, because the cost of a run is something the user paid for
 * and should be able to see.
 *
 * `progress` is passed in rather than read here, because this function is pure
 * projection and its callers already differ on whether they have one: the
 * watcher reads it every tick, the ACCEPTED frame has nothing to report yet.
 *
 * @param {object} job
 * @param {object} [progress] - {step_count, tool} from generation-progress
 * @returns {object}
 */
export const project_generation_job = (job, progress = null) => ({
  progress_step_count: progress?.step_count ?? null,
  progress_tool: progress?.tool ?? null,
  generation_id: job.generation_id,
  status: job.status,
  instruction: job.instruction,
  result: job.result ?? null,
  generation_branch: job.generation_branch ?? null,
  error_code: job.error_code ?? null,
  error_message: job.error_message ?? null,
  tool_call_count: job.tool_call_count ?? null,
  total_tokens: job.total_tokens ?? null,
  duration_milliseconds: job.duration_milliseconds ?? null,
  queued_at: job.queued_at,
  started_at: job.started_at ?? null,
  completed_at: job.completed_at ?? null,
  deadline_at: job.deadline_at
})

/**
 * The admission check, and the ONE place a caller is required to be both signed
 * in and entitled.
 *
 * BOTH CHECKS LIVE HERE, AND THAT IS THE PROPERTY WORTH KEEPING. The whole
 * anonymous-later design rests on opening generation up being the DELETION of
 * checks in this function rather than a re-keying of anything; a second gate
 * somewhere else would break it, because deleting this body would then still
 * leave a caller refused with no obvious cause.
 *
 * The entitlement fails CLOSED on a user row that is not there. A missing row
 * for an authenticated id means the account was deleted mid-session or the
 * token outlived it, and neither is a reason to admit a run.
 *
 * The principal the queue stores is resolved separately by
 * resolve_principal_key, whose anonymous branch already exists and is already
 * exercised by its own spec.
 *
 * @param {object} params
 * @param {number|null} params.user_id
 * @param {object} [params.connection] - knex handle, injectable for the spec
 * @returns {Promise<{admitted: boolean, error_code?: string, message?: string}>}
 */
export const require_generation_principal = async ({
  user_id,
  connection = db
}) => {
  if (!user_id) {
    return {
      admitted: false,
      error_code: 'authentication_required',
      message: 'generation requires a signed-in account'
    }
  }

  const user = await connection('users')
    .select('data_view_generation_is_enabled')
    .where({ id: user_id })
    .first()

  if (!user?.data_view_generation_is_enabled) {
    return {
      admitted: false,
      error_code: 'generation_not_enabled',
      message: 'this account is not enabled for view generation'
    }
  }

  return { admitted: true }
}

const send_error = (
  ws,
  { generation_id = null, error_code, message, ...rest }
) =>
  send_websocket_message(ws, 'DATA_VIEW_GENERATION_ERROR', {
    generation_id,
    error_code,
    message,
    ...rest
  })

/**
 * Poll one job until it reaches a terminal state, sending a frame whenever its
 * status or its PROGRESS changes, and one final frame.
 *
 * Frames on CHANGE rather than on every tick, because a run is minutes long and
 * a client does not need 300 identical `running` frames to learn that nothing
 * happened.
 *
 * PROGRESS IS THE SECOND CHANGE AXIS, and adding it is what makes the panel
 * move. Status alone reaches `running` within seconds and then never changes
 * again for up to fifteen minutes, so a client watching only that cannot tell a
 * run doing useful work from one wedged on a broken tool -- which is exactly
 * what happened on 2026-09-04. The step count is monotonic within a run, so
 * comparing it is enough and no timestamp needs to be trusted.
 *
 * @param {object} params
 * @param {object} params.ws
 * @param {string} params.generation_id
 * @param {(generation_id: string) => Promise<object|undefined>} [params.read_job]
 * @param {(params: object) => Promise<object|null>} [params.read_progress]
 * @param {number} [params.interval_ms]
 * @returns {Promise<void>}
 */
export const watch_generation_job = async ({
  ws,
  generation_id,
  read_job = get_generation_job,
  read_progress = read_generation_progress,
  interval_ms = POLL_INTERVAL_MS
}) => {
  const watchers = get_watchers(ws)
  const watcher = { stopped: false }
  watchers.set(generation_id, watcher)

  let last_status = null
  let last_step_count = null
  try {
    for (;;) {
      if (watcher.stopped || ws.readyState !== 1) return

      const job = await read_job(generation_id)
      if (!job) {
        // The row vanished under a live watch. Nothing deletes a job row in
        // normal operation, so this is a truncated table or a hand-run DELETE;
        // say so rather than polling an empty result forever.
        send_error(ws, {
          generation_id,
          error_code: 'generation_vanished',
          message: 'the generation job no longer exists'
        })
        return
      }

      const progress = await read_progress({ generation_id })
      const step_count = progress?.step_count ?? null

      if (job.status !== last_status || step_count !== last_step_count) {
        last_status = job.status
        last_step_count = step_count
        send_websocket_message(
          ws,
          'DATA_VIEW_GENERATION_UPDATE',
          project_generation_job(job, progress)
        )
      }

      if (!LIVE_STATUSES.includes(job.status)) return

      await new Promise((resolve) => setTimeout(resolve, interval_ms))
    }
  } finally {
    watchers.delete(generation_id)
  }
}

/**
 * Accept an instruction and put a generation job on the queue.
 *
 * @param {object} params
 * @param {object} params.ws
 * @param {number|null} params.user_id
 * @param {object} params.payload
 * @param {(job: object) => Promise<void>} [params.watch] - injected by the spec
 * @returns {Promise<object|null>} the created job, or null when refused
 */
export const handle_generation_request = async ({
  ws,
  user_id,
  payload,
  watch = watch_generation_job
}) => {
  const admission = await require_generation_principal({ user_id })
  if (!admission.admitted) {
    send_error(ws, admission)
    return null
  }

  let job
  try {
    // The spend limits are checked BEFORE the queue's depth limit, because they
    // answer different questions and the caller can act on only one of them. A
    // depth refusal says "try again shortly" and is true; a rate refusal that
    // arrived as a depth refusal would send a caller back every few seconds for
    // an hour.
    await assert_generation_admissible({
      principal_key: resolve_principal_key({ user_id })
    })

    job = await enqueue_generation_job({
      instruction: payload?.instruction,
      input_table_state: payload?.table_state ?? null,
      user_id
    })
  } catch (error) {
    if (error instanceof GenerationQueueError) {
      // EVERY refusal reports the number it refused on, not just the depth
      // one. A caller told only "no" cannot tell "wait ten seconds" from "wait
      // an hour" from "this is switched off", and those are the three answers
      // this path gives. The detail fields ride on the error itself
      // (queue_depth, runs, total_tokens), so a new limit reports its own
      // number without touching this frame.
      const { code, message, is_invalid_request, ...detail } = error
      send_error(ws, {
        error_code: code,
        message,
        ...detail,
        max_queue_depth: MAX_QUEUE_DEPTH
      })
      return null
    }
    throw error
  }

  send_websocket_message(ws, 'DATA_VIEW_GENERATION_ACCEPTED', {
    ...project_generation_job(job),
    queue_depth: await get_queue_depth(),
    max_queue_depth: MAX_QUEUE_DEPTH
  })

  watch({ ws, generation_id: job.generation_id }).catch((error) =>
    log('watch failed for %s: %s', job.generation_id, error.message)
  )

  return job
}

/**
 * Reconnect and collect: serve a job the caller already has an id for.
 *
 * @param {object} params
 * @param {object} params.ws
 * @param {number|null} params.user_id
 * @param {object} params.payload
 * @param {(generation_id: string) => Promise<object|undefined>} [params.read_job]
 * @param {(job: object) => Promise<void>} [params.watch] - injected by the spec
 * @returns {Promise<object|null>}
 */
export const handle_generation_collect = async ({
  ws,
  user_id,
  payload,
  read_job = get_generation_job,
  watch = watch_generation_job
}) => {
  const admission = await require_generation_principal({ user_id })
  if (!admission.admitted) {
    send_error(ws, admission)
    return null
  }

  const generation_id = payload?.generation_id
  if (!generation_id) {
    send_error(ws, {
      error_code: 'generation_id_required',
      message: 'collecting a generation needs its generation_id'
    })
    return null
  }

  const job = await read_job(generation_id)

  // ONE refusal for "no such job" and "not yours", deliberately. Distinguishing
  // them turns the endpoint into an oracle for which opaque ids exist, and the
  // caller can do nothing different with the two answers.
  if (!job || job.user_id !== user_id) {
    send_error(ws, {
      generation_id,
      error_code: 'generation_not_found',
      message: 'no generation with that id is available to this account'
    })
    return null
  }

  // With progress, so a client that reloaded mid-run sees which step it is on
  // rather than waiting up to a poll interval for the watcher's first frame.
  send_websocket_message(
    ws,
    'DATA_VIEW_GENERATION_UPDATE',
    project_generation_job(
      job,
      await read_generation_progress({ generation_id })
    )
  )

  // Still live: resume watching. Already finished: the frame above WAS the
  // collect, which is the whole reconnect-and-collect contract.
  if (LIVE_STATUSES.includes(job.status)) {
    watch({ ws, generation_id }).catch((error) =>
      log('watch failed for %s: %s', generation_id, error.message)
    )
  }

  return job
}

/**
 * Stop this socket's watchers. Called on close.
 *
 * STOPS THE POLLING, NOT THE RUN. See the note on socket_watchers.
 *
 * @param {object} ws
 */
export const stop_generation_watchers = (ws) => {
  const watchers = socket_watchers.get(ws)
  if (!watchers) return
  for (const [, watcher] of watchers) watcher.stopped = true
  socket_watchers.delete(ws)
}

export default {
  handle_generation_collect,
  handle_generation_request,
  project_generation_job,
  require_generation_principal,
  stop_generation_watchers,
  watch_generation_job
}
