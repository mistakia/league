import debug from 'debug'

import db from '#db'
import {
  fail_generation_job,
  record_generation_trajectory,
  mark_generation_session_termination_requested,
  LIVE_STATUSES
} from '#libs-server/data-views/generation/generation-job-queue.mjs'
import { record_generation_spend } from '#libs-server/data-views/generation/generation-limits.mjs'
import {
  get_base_session_token,
  reset_base_session_token,
  kill_generation_session,
  BaseSessionError
} from '#libs-server/data-views/generation/base-session-client.mjs'
import { close_generation_timeline_feed } from '#libs-server/data-views/generation/generation-timeline-subscription.mjs'

const log = debug('data-views:generation-collector')

// The collector: what league learns about a run it does not operate.
//
// TWO FACTS COME FROM HERE, AND NEITHER CAN COME FROM ANYWHERE ELSE.
//
//   LIVENESS. The agent pushes its emission when it emits (deliver-emission.mjs
//   -> POST /api/data-views/generation-emission), so a SUCCESSFUL run closes
//   its own job row. A run that dies without emitting -- the model unreachable,
//   the harness crashed, the agent stopping mid-loop -- pushes nothing, and the
//   row would sit in `running` until the 15-minute deadline swept it. That is a
//   quarter hour of a user watching a spinner for a run that ended in seconds,
//   and at a depth limit of 8 it is also a queue slot held for nothing.
//
//   TRAJECTORY. tool_call_count, total_tokens and duration are base's to
//   measure, not the agent's to self-report: a model cannot count its own
//   tokens and an agent asked for its own tool count is guessing. They live on
//   the thread record base already keeps.
//
// A POLL, NOT A PUSH, and the direction is forced. Base does not call league,
// and the container is a sandbox that must not hold a league credential, so the
// only actor that can ask is league -- with the same identity key the drainer
// already dispatches on.

const REQUEST_TIMEOUT_MS = 30 * 1000

// Mirrors TERMINAL_STATUSES in base's libs-shared/thread-lifecycle.mjs. A
// status outside base's live set means the harness is gone.
const TERMINAL_SESSION_STATUSES = ['ended', 'failed']

// How long after a job finishes league keeps trying to attach a trajectory to
// it. Without a bound, a thread base can no longer serve is re-read on every
// pass forever. Past it the trajectory is simply lost and the row's nulls say
// so, which is honest -- unlike a zero, which reads as a run that called no
// tools.
const TRAJECTORY_WINDOW_MS = 60 * 60 * 1000

/**
 * Total tokens for a run, summed from the thread's own cumulative counters.
 *
 * NOT `provider_metadata.total_tokens`, which is present and reads 0 on live
 * threads -- taking it would record every run as free. The four cumulative_*
 * fields are the ones the harness actually increments, and cache reads are
 * included because they are billed.
 *
 * @param {object} thread
 * @returns {number|null}
 */
export const derive_total_tokens = (thread) => {
  const fields = [
    'cumulative_input_tokens',
    'cumulative_output_tokens',
    'cumulative_cache_creation_input_tokens',
    'cumulative_cache_read_input_tokens'
  ]
  const present = fields.filter((field) => Number.isFinite(thread?.[field]))
  if (!present.length) {
    const reported = thread?.external_session?.provider_metadata?.total_tokens
    return Number.isFinite(reported) && reported > 0 ? reported : null
  }
  return present.reduce((sum, field) => sum + thread[field], 0)
}

/**
 * Read one thread off base's API.
 *
 * `timeline_limit=0` because none of it is wanted: the emission arrives by push
 * and a generation transcript is large enough that pulling it on every pass
 * would be the most expensive thing this module does.
 *
 * @param {object} params
 * @param {string} params.thread_id
 * @param {(url: string, init: object) => Promise<Response>} [params.fetch_impl]
 * @returns {Promise<object|null>} the thread, or null when base has none
 */
export const read_generation_thread = async ({
  thread_id,
  fetch_impl = fetch
}) => {
  const base_url = process.env.BASE_API_URL
  if (!base_url) {
    throw new BaseSessionError(
      'base_api_url_unset',
      'BASE_API_URL is not set, so there is no base rail to read a generation thread from'
    )
  }

  const url = `${base_url.replace(/\/$/, '')}/api/threads/${thread_id}?timeline_limit=0`
  const get = async (token) =>
    fetch_impl(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

  let response = await get(await get_base_session_token())
  // Same one-retry-on-401 as the dispatch path: a rotated identity key
  // invalidates every token base ever issued, and a cached one outlives it.
  if (response.status === 401) {
    reset_base_session_token()
    response = await get(await get_base_session_token({ force: true }))
  }

  if (response.status === 404) return null
  if (!response.ok) {
    const text = await response.text()
    throw new BaseSessionError(
      'base_thread_unreadable',
      `base refused a thread read with ${response.status}: ${text.slice(0, 200)}`,
      { status: response.status }
    )
  }

  return response.json()
}

/**
 * The jobs worth asking base about on this pass.
 *
 * Two populations, and they are different questions. A `running` job is asked
 * "did the session end", because nothing else can tell league that. A finished
 * one is asked "what did it cost" and "is its session still up" -- the emission
 * closed the row before league knew either.
 *
 * `tool_call_count IS NULL` is exactly "no trajectory recorded" and needs no
 * column of its own. The teardown DOES need one: it is an action rather than a
 * value, so nothing on the row would otherwise say it had happened, and a
 * 5-second drainer would repeat it for the whole hour-long window.
 *
 * @returns {Promise<Array<object>>}
 */
export const select_collectable_jobs = async () =>
  db('data_view_generation_jobs')
    .whereNotNull('thread_id')
    .where((builder) =>
      builder.where('status', 'running').orWhere((finished) =>
        finished
          .whereIn('status', ['completed', 'failed', 'expired'])
          // Either half is reason to look at a finished job: it still owes a
          // trajectory, or its session has not been torn down. They are separate
          // because the teardown is what MAKES the trajectory readable -- see
          // collect_job -- so a job needing the reap has not yet reached the
          // point where a trajectory could have been recorded.
          .where((needs) =>
            needs
              .whereNull('tool_call_count')
              .orWhereNull('session_termination_requested_at')
          )
          .where(
            'completed_at',
            '>',
            db.raw(`now() - interval '${TRAJECTORY_WINDOW_MS} milliseconds'`)
          )
      )
    )
    .orderBy('queued_at', 'asc')

/**
 * Collect one job: attach its trajectory, and close it if its session is gone.
 *
 * @param {object} params
 * @param {object} params.job
 * @param {(params: object) => Promise<object|null>} [params.read_thread]
 * @returns {Promise<{outcome: string}>}
 */
export const collect_job = async ({
  job,
  read_thread = read_generation_thread,
  kill_session = kill_generation_session
}) => {
  // TEAR THE SESSION DOWN THE MOMENT THE JOB IS TERMINAL, and do it before
  // ANYTHING ELSE IN THIS FUNCTION -- including the thread read.
  //
  // The read used to come first, and that ordering silently disarmed the
  // teardown for exactly the case it exists for. `read_thread` THROWS on an
  // unreadable thread (a 401, a 5xx, base restarting), collect_once catches
  // per job and moves on, and the kill below is never reached -- so the run
  // this is meant to stop keeps running, and every later pass takes the same
  // path. Measured 2026-09-04: an expired job's agent was still alive twenty
  // minutes past its deadline with session_termination_requested_at NULL,
  // spending GPU on an answer the delivery door would refuse, and holding the
  // profile's single session slot so that every subsequent generation sat in
  // `queued` and expired without ever dispatching. One dead run wedged the
  // whole queue.
  //
  // Nothing below needs the thread in order to decide this: the job's own
  // status is what says the run is over, and that comes from league's row.
  //
  // This is not tidying -- it is what makes the rest of this module work. A
  // generation is one-shot, but base launches every session as an interactive
  // REPL, so a healthy agent that has answered sits at an idle prompt at
  // `awaiting_user` FOREVER. That is not in TERMINAL_SESSION_STATUSES, so the
  // `session_is_over` gate below would never open and no trajectory would ever
  // be recorded for a successful run. Killing the session is what drives it to a
  // terminal status; the NEXT pass then records the trajectory.
  //
  // It also stops the runaway on the other side. An expired job's agent keeps
  // running after the deadline sweep closes league's row -- measured 2026-09-03
  // still thinking twenty minutes in, spending GPU and tokens on an answer the
  // emission route would refuse.
  //
  // Stamped whether or not base obliged, because a refusal retried every 5
  // seconds for an hour is its own runaway.
  if (!LIVE_STATUSES.includes(job.status)) {
    // The live feed dies with the run, on the SAME condition as the session
    // teardown but outside its claim guard. The teardown is claimed so exactly
    // one drainer fires the kill; closing a local socket has no such
    // contention, and gating it on the claim would leave the feed open forever
    // on every pass that lost the race.
    close_generation_timeline_feed({ generation_id: job.generation_id })
  }

  if (
    !LIVE_STATUSES.includes(job.status) &&
    !job.session_termination_requested_at
  ) {
    const claimed = await mark_generation_session_termination_requested({
      generation_id: job.generation_id
    })
    // 0 rows means a concurrent drainer claimed the teardown; leave it to them
    // rather than firing a second kill at the same thread.
    if (claimed) {
      const { killed, reason } = await kill_session({
        thread_id: job.thread_id
      })
      if (!killed) {
        log(
          'session teardown for %s did not take: %s',
          job.generation_id,
          reason
        )
      }
    }
  }

  const thread = await read_thread({ thread_id: job.thread_id })

  if (!thread) {
    // Base has no such thread. For a live job that is terminal -- the session
    // it was dispatched onto does not exist, and waiting for the deadline would
    // only delay the same answer by a quarter of an hour.
    if (LIVE_STATUSES.includes(job.status)) {
      await fail_generation_job({
        generation_id: job.generation_id,
        error_code: 'agent_session_missing',
        error_message: `base has no thread ${job.thread_id} for this generation`
      })
      return { outcome: 'failed' }
    }
    return { outcome: 'unreadable' }
  }

  const session_is_over = TERMINAL_SESSION_STATUSES.includes(
    thread.session_status
  )

  // NOTHING IS RECORDED WHILE THE SESSION IS STILL GOING. A mid-run count is a
  // partial one, and writing it would satisfy the `tool_call_count IS NULL`
  // predicate this module selects on -- so the job would never be revisited and
  // the partial figure would stand as the run's final cost. Waiting for the
  // session to end is what makes one write per run both sufficient and true.
  if (!session_is_over) return { outcome: 'running' }

  // Recorded BEFORE the liveness branch below, so a run that ended without
  // emitting still records what it spent. A failed run's cost is the one most
  // worth having.
  await record_generation_trajectory({
    generation_id: job.generation_id,
    tool_call_count: Number.isFinite(thread.tool_call_count)
      ? thread.tool_call_count
      : null,
    total_tokens: derive_total_tokens(thread),
    duration_milliseconds: null,
    // WHICH MODEL SERVED IT, and league can only learn it here. The container
    // does not know which provider the gateway routed it to, and a cost figure
    // with no provider beside it cannot be compared across a model change --
    // which is the comparison the benchmark exists to make.
    inference_provider: thread.inference_provider ?? null
  })

  // Charge the run against its principal's window budget, at the one moment
  // league knows what it cost. The per-job ceiling is applied inside: a runaway
  // is recorded on the job and NOT charged to the window, so one bad
  // instruction cannot lock its author out for an hour.
  const total_tokens = derive_total_tokens(thread)
  if (job.principal_key && total_tokens) {
    await record_generation_spend({
      principal_key: job.principal_key,
      total_tokens
    })
  }

  if (!LIVE_STATUSES.includes(job.status)) return { outcome: 'trajectory' }

  // The session is over and the row is still live, which means no emission ever
  // arrived. The two are named apart because they send an operator somewhere
  // different: a clean exit with no deliverable is the AGENT giving up without
  // using its emit tool, while a failed harness is the rail or the model.
  const [error_code, error_message] =
    thread.session_status === 'failed'
      ? [
          'agent_session_failed',
          'the agent session failed before emitting a view'
        ]
      : [
          'agent_ended_without_emission',
          'the agent session ended without emitting a view'
        ]

  await fail_generation_job({
    generation_id: job.generation_id,
    error_code,
    error_message
  })
  return { outcome: 'failed' }
}

/**
 * One collection pass over every collectable job.
 *
 * @param {object} [params]
 * @param {(params: object) => Promise<object|null>} [params.read_thread]
 * @returns {Promise<{collected: number}>}
 */
export const collect_once = async ({ read_thread, kill_session } = {}) => {
  const jobs = await select_collectable_jobs()
  let collected = 0
  for (const job of jobs) {
    try {
      await collect_job({
        job,
        ...(read_thread ? { read_thread } : {}),
        ...(kill_session ? { kill_session } : {})
      })
      collected += 1
    } catch (error) {
      // One unreadable thread must not stop the pass. The next pass retries it,
      // and the deadline sweep bounds how long that can go on.
      log('collect failed for %s: %s', job.generation_id, error.message)
    }
  }
  return { collected }
}

export default {
  collect_job,
  collect_once,
  derive_total_tokens,
  read_generation_thread,
  select_collectable_jobs
}
