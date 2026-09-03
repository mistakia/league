import debug from 'debug'

import {
  claim_next_generation_job,
  mark_generation_job_running,
  release_generation_job,
  fail_generation_job,
  expire_overdue_generation_jobs
} from '#libs-server/data-views/generation/generation-job-queue.mjs'
import {
  dispatch_generation_session,
  BaseSessionError
} from '#libs-server/data-views/generation/base-session-client.mjs'

const log = debug('data-views:generation-drainer')

// The drainer: claim a queued generation job and hand it to base's session rail.
//
// It is deliberately SMALL, and what it is not doing is the point. It does not
// hold a loop, does not talk to a model, does not own concurrency, and does not
// watch a running agent. Base's durable thread-creation queue and its worker
// already serialize spawns, park on capacity exhaustion and reap dead sessions;
// this walks league's own row through the three states those mechanisms cannot
// see, and stops.
//
// ONE JOB PER PASS, on purpose. The binding resource is a single GPU tenant and
// the profile's own ceiling is one concurrent session, so a pass that claimed
// several would only produce dispatches base immediately refuses -- while
// holding several rows in `dispatched` where the deadline sweep counts them
// against the queue depth.

// How long a claimed-but-undispatched row may sit before the deadline sweep
// takes it. Not a constant here: the deadline is the row's own column DEFAULT,
// on the server clock. Named only so the failure below can say what happens.
export const DRAIN_INTERVAL_MS = 5000

/**
 * Whether a dispatch failure should return the job to the queue rather than
 * fail it.
 *
 * CAPACITY IS NOT A FAILURE. Base refusing with 429 because the profile's one
 * session slot is occupied is the queue working, and failing the row for it
 * would surface a transient wait to the user as a dead generation. The same
 * holds for base being unable to read the container's session count (503),
 * which is what a base-api restart looks like from here.
 *
 * Everything else IS terminal for this attempt: a malformed identity key, a
 * refused signature, an unset BASE_API_URL. Those do not clear by waiting, and
 * re-queueing them spins the drainer against the same error until the deadline.
 *
 * @param {Error} error
 * @returns {boolean}
 */
export const is_retryable_dispatch_failure = (error) =>
  error instanceof BaseSessionError &&
  (error.code === 'base_capacity_reached' ||
    error.code === 'base_container_unreadable')

/**
 * Claim at most one job and dispatch it.
 *
 * @param {object} [params]
 * @param {(job: {generation_id: string, instruction: string,
 *   input_table_state: object|null}) => Promise<{thread_id: string}>}
 *   [params.dispatch] - injected by the spec
 * @returns {Promise<{drained: boolean, generation_id?: string, outcome?: string}>}
 */
export const drain_once = async ({
  dispatch = dispatch_generation_session
} = {}) => {
  // Sweep FIRST. enqueue_generation_job also sweeps, which covers a queue that
  // is being used; this covers one that is not -- a job that stalled in
  // `running` after the last arrival would otherwise hold a slot until the next
  // one, and at a depth limit of 8 a handful of them wedge the queue.
  await expire_overdue_generation_jobs()

  const job = await claim_next_generation_job()
  if (!job) return { drained: false }

  const { generation_id } = job

  let thread_id
  try {
    ;({ thread_id } = await dispatch({
      generation_id,
      instruction: job.instruction,
      input_table_state: job.input_table_state
    }))
  } catch (error) {
    if (is_retryable_dispatch_failure(error)) {
      log('returning %s to the queue: %s', generation_id, error.message)
      await release_generation_job({ generation_id })
      return { drained: true, generation_id, outcome: 'released' }
    }
    log('failing %s: %s', generation_id, error.message)
    await fail_generation_job({
      generation_id,
      error_code: error.code || 'dispatch_failed',
      error_message: error.message
    })
    return { drained: true, generation_id, outcome: 'failed' }
  }

  // AFTER the dispatch, never before. Writing `running` first would claim the
  // agent had started for every job base then refused, and the refusal path
  // above returns the row to `queued` -- a row cannot be both.
  await mark_generation_job_running({ generation_id, thread_id })
  return { drained: true, generation_id, outcome: 'running', thread_id }
}

/**
 * Drain on an interval until stopped.
 *
 * Returns its own stop function rather than exposing a module-scope handle: two
 * drainers in one process is a double-dispatch bug, and a stop that reaches
 * into module state cannot tell which one it is stopping.
 *
 * @param {object} [params]
 * @param {number} [params.interval_ms]
 * @returns {{stop: Function}}
 */
export const start_generation_drainer = ({
  interval_ms = DRAIN_INTERVAL_MS
} = {}) => {
  let running = false
  const timer = setInterval(async () => {
    // A pass that overruns the interval must not start a second one. The claim
    // is atomic so a double pass could not double-dispatch a job, but it can
    // stack open connections against a pool of two.
    if (running) return
    running = true
    try {
      await drain_once()
    } catch (error) {
      // NEVER let a drain failure kill the interval. A drainer that stops on
      // one bad row stops serving every later one, silently.
      log('drain pass failed: %s', error.message)
    } finally {
      running = false
    }
  }, interval_ms)

  // Do not hold the process open for the sake of the drainer.
  if (timer.unref) timer.unref()

  return { stop: () => clearInterval(timer) }
}

export default {
  DRAIN_INTERVAL_MS,
  drain_once,
  is_retryable_dispatch_failure,
  start_generation_drainer
}
