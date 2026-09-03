import db from '#db'

// The generation job queue: a durable league-side row per request, claimed by a
// drainer that hands it to the session runner.
//
// The design rationale lives in ONE place, the table's own DDL at
// db/adhoc/2026-09-02-create-data-view-generation-jobs.sql -- why a durable row
// rather than the in-process admission gate, why the key is an opaque
// generation_id rather than a user, and why this row is also the audit record.
// Read it there.
//
// preview_view, the one generation tool that contends for ordinary query slots,
// rides the existing data-view admission gate rather than this queue.

// THE DEPTH LIMIT.
//
// Generation runs minutes, and the backend that serves it may permit as little
// as one concurrent run. An unbounded queue turns that into a silent wait of
// unknown length -- the failure tune-data-view-request-queue spent 24 steps
// deleting: a global processing flag, an unbounded wait, and queue positions
// that never refresh. So the queue REFUSES above a stated depth rather than
// accepting work it cannot start, and the refusal reports the depth.
export const MAX_QUEUE_DEPTH = 8

// The wall-clock bound on a single run, in milliseconds. Exported for the spec
// and for anything reporting the bound to a caller; the value that actually
// applies is the deadline_at column DEFAULT, which is server-clock. Keep the
// two in step -- this constant does not set the deadline.
export const JOB_DEADLINE_MS = 15 * 60 * 1000

// Statuses that occupy a queue slot. Everything else is terminal.
export const LIVE_STATUSES = ['queued', 'dispatched', 'running']

export class GenerationQueueError extends Error {
  constructor(code, message, detail = {}) {
    super(message)
    this.name = 'GenerationQueueError'
    this.code = code
    this.is_invalid_request = true
    Object.assign(this, detail)
  }
}

/**
 * The rate-limit and token-budget principal, resolved in ONE place.
 *
 * user_id when authenticated, CF-Connecting-IP otherwise. The anonymous branch
 * is written now and left unreachable behind the admission check, so opening
 * generation up later is DELETING that check rather than re-keying a live
 * limiter against rows that were keyed on something else.
 *
 * @param {object} params
 * @param {number|null} [params.user_id]
 * @param {string|null} [params.connecting_ip]
 * @returns {string}
 */
export const resolve_principal_key = ({ user_id, connecting_ip }) => {
  if (user_id) return `user:${user_id}`
  if (connecting_ip) return `ip:${connecting_ip}`
  throw new GenerationQueueError(
    'principal_unresolved',
    'a generation job needs either an authenticated user or a connecting ip'
  )
}

/**
 * Count the jobs currently occupying a queue slot.
 *
 * @returns {Promise<number>}
 */
export const get_queue_depth = async () => {
  const [row] = await db('data_view_generation_jobs')
    .whereIn('status', LIVE_STATUSES)
    .count({ depth: '*' })
  return Number(row.depth)
}

/**
 * Enqueue one generation job, or REFUSE because the queue is full.
 *
 * @param {object} params
 * @param {string} params.instruction
 * @param {object|null} [params.input_table_state] - the edit case
 * @param {number|null} [params.user_id]
 * @param {string|null} [params.connecting_ip]
 * @returns {Promise<object>} the created job row
 */
export const enqueue_generation_job = async ({
  instruction,
  input_table_state = null,
  user_id = null,
  connecting_ip = null
}) => {
  if (!instruction || !String(instruction).trim()) {
    throw new GenerationQueueError(
      'instruction_required',
      'a generation job needs an instruction'
    )
  }

  const principal_key = resolve_principal_key({ user_id, connecting_ip })

  // Expire overdue jobs FIRST, so the depth count below cannot be inflated by
  // jobs that are already dead. This is what makes the deadline a real bound
  // rather than a column nobody reads: without it a job that stalls in
  // `running` holds a slot forever, and MAX_QUEUE_DEPTH of them wedge the queue
  // permanently for every user. Doing it here rather than on a timer means the
  // bound needs no scheduler to exist -- it is enforced by the next arrival,
  // which is exactly when it matters.
  //
  // It is still worth calling on a timer once a drainer exists, so that a queue
  // nobody is using also drains; this call is the floor, not the ceiling.
  await expire_overdue_generation_jobs()

  // Checked BEFORE the insert and reported with the depth, so a refused caller
  // learns how full the queue is rather than being told only "no".
  //
  // Two honest limits on what this bound is. It is not locked, so N concurrent
  // enqueues can each read a depth below the limit and each insert -- overshoot
  // is bounded by concurrency, not by one. And it is GLOBAL, not per-principal,
  // so one caller can occupy every slot; keying it per principal needs the
  // limiter that principal_key exists for and does not exist yet. The bound is
  // a product decision about wait time, not an invariant.
  const depth = await get_queue_depth()
  if (depth >= MAX_QUEUE_DEPTH) {
    throw new GenerationQueueError(
      'queue_full',
      `generation queue is at its depth limit of ${MAX_QUEUE_DEPTH}; try again shortly`,
      { queue_depth: depth, max_queue_depth: MAX_QUEUE_DEPTH }
    )
  }

  const [job] = await db('data_view_generation_jobs')
    .insert({
      instruction: String(instruction).trim(),
      input_table_state: input_table_state
        ? JSON.stringify(input_table_state)
        : null,
      user_id,
      principal_key,
      status: 'queued'
      // deadline_at is left to the column DEFAULT, which is server-clock. An
      // API host computing `Date.now() + JOB_DEADLINE_MS` here would set the
      // bound on one clock and sweep it on another, so host skew would move it.
    })
    .returning('*')

  return job
}

/**
 * Read one job by its opaque id.
 *
 * This is the reconnect-and-collect path: a client that disconnected mid-run
 * comes back holding only its generation_id and reads the finished view.
 *
 * @param {string} generation_id
 * @returns {Promise<object|undefined>}
 */
export const get_generation_job = async (generation_id) =>
  db('data_view_generation_jobs').where({ generation_id }).first()

/**
 * Claim the oldest queued job for dispatch, atomically.
 *
 * FOR UPDATE SKIP LOCKED on the subselect is the whole mechanism, matching
 * get_next_queued_job() on external_league_import_jobs. It does both jobs at
 * once under READ COMMITTED: a row another drainer holds is SKIPPED, and a row
 * another drainer already committed fails the subselect's own recheck against
 * the new row version. So the subselect only ever returns a row this
 * transaction has already locked and confirmed queued, and a double claim --
 * which would run one user's instruction twice -- cannot happen.
 *
 * An earlier draft also carried `status = 'queued'` on the OUTER update, with a
 * long argument that a blocked second statement would otherwise re-check only
 * `generation_id` and claim the row twice. That argument was wrong: such a
 * statement cannot reach the outer update, because by then it holds the lock
 * and the subselect has already excluded the row. Removing the predicate leaves
 * the race test green, which is what established it was unexercised.
 *
 * @param {object} [connection] - a knex or transaction handle. The parameter
 *   exists so a test can drive two genuinely concurrent claims on separate
 *   connections, which is the only way to exercise this at all -- two claims on
 *   one pool serialize and pass whether or not the locking clause is there.
 * @returns {Promise<object|undefined>} the claimed job, or undefined if none
 */
export const claim_next_generation_job = async (connection = db) => {
  // knex's pg raw returns a pg Result, so the row is under `.rows` -- a
  // destructure off the result itself silently yields the Result's first
  // enumerable property rather than a job.
  const { rows } = await connection.raw(
    `UPDATE data_view_generation_jobs
        SET status = 'dispatched', dispatched_at = NOW()
      WHERE generation_id = (
              SELECT generation_id
                FROM data_view_generation_jobs
               WHERE status = 'queued'
               ORDER BY queued_at ASC
               LIMIT 1
                 FOR UPDATE SKIP LOCKED
            )
    RETURNING *`
  )
  return rows[0]
}

/**
 * Return a claimed job to the queue, because the dispatch could not be made
 * for a reason that clears on its own.
 *
 * THE HEAD-OF-LINE VALVE. Base refuses a dispatch with 429 whenever the
 * profile's one session slot is occupied, which at the concurrency a single GPU
 * tenant permits is the ORDINARY answer rather than an error. Failing the row
 * for it would show a user a dead generation for a wait of a few seconds; the
 * job goes back to the head of the queue instead and the next pass takes it.
 *
 * `dispatched_at` is cleared with the status, so a released job is
 * indistinguishable from one that was never claimed -- otherwise the audit
 * record would read as though the run began and the trajectory fields would
 * hang off a dispatch that did not happen.
 *
 * `queued_at` is deliberately NOT touched. It is the claim order, so bumping it
 * would send a released job to the BACK of the queue behind everything that
 * arrived while it waited, and a job could starve indefinitely under load --
 * which is precisely the unbounded silent wait this queue exists to refuse.
 *
 * Scoped to `dispatched`, so a job that has since gone `running`, `failed` or
 * `expired` is not resurrected by a late release.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @param {object} [params.connection] - see claim_next_generation_job
 * @returns {Promise<number>} rows updated
 */
export const release_generation_job = async ({
  generation_id,
  connection = db
}) =>
  connection('data_view_generation_jobs')
    .where({ generation_id, status: 'dispatched' })
    .update({ status: 'queued', dispatched_at: null })

/**
 * Record that the dispatched session actually started.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @param {string} params.thread_id - base's session id
 * @param {object} [params.connection] - see claim_next_generation_job; every
 *   mutator here takes one for the same reason, and the reason is a deadlock
 * @returns {Promise<number>} rows updated
 */
export const mark_generation_job_running = async ({
  generation_id,
  thread_id,
  connection = db
}) =>
  connection('data_view_generation_jobs')
    .where({ generation_id, status: 'dispatched' })
    .update({ status: 'running', thread_id, started_at: connection.fn.now() })

/**
 * Complete a job with the agent's emitted envelope and its trajectory.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @param {object} params.result - the emit envelope
 * @param {string} params.generation_branch - registry | query | refusal
 * @param {object} [params.trajectory] - tool_call_count, total_tokens
 * @param {object} [params.connection] - see claim_next_generation_job
 * @returns {Promise<number>} rows updated
 */
export const complete_generation_job = async ({
  generation_id,
  result,
  generation_branch,
  trajectory = {},
  connection = db
}) =>
  // ONE statement. An earlier draft read the row first purely to get
  // started_at, which shipped instruction, input_table_state and result --
  // three TOAST-able jsonb columns -- to Node to compute one subtraction.
  // Deriving it in SQL also puts both ends of the interval on the server clock,
  // where a Date.now() minus a server-generated started_at mixed two.
  connection('data_view_generation_jobs')
    .where({ generation_id })
    .whereIn('status', LIVE_STATUSES)
    .update({
      // A refusal is a COMPLETED job carrying generation_branch = 'refusal'.
      // Recording it as a failure would fold a legitimate agent answer in with
      // the provider being unreachable and make both metrics meaningless.
      status: 'completed',
      result: JSON.stringify(result),
      generation_branch,
      tool_call_count: trajectory.tool_call_count ?? null,
      total_tokens: trajectory.total_tokens ?? null,
      duration_milliseconds: connection.raw(
        'CASE WHEN started_at IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::integer END'
      ),
      completed_at: connection.fn.now()
    })

/**
 * Fail a job with a named code.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @param {string} params.error_code
 * @param {string} params.error_message
 * @param {object} [params.connection] - see claim_next_generation_job
 * @returns {Promise<number>} rows updated
 */
export const fail_generation_job = async ({
  generation_id,
  error_code,
  error_message,
  connection = db
}) =>
  connection('data_view_generation_jobs')
    .where({ generation_id })
    .whereIn('status', LIVE_STATUSES)
    .update({
      status: 'failed',
      error_code,
      error_message,
      completed_at: connection.fn.now()
    })

/**
 * Expire every live job past its deadline.
 *
 * Called by enqueue_generation_job before it counts the queue, so the bound
 * needs no scheduler to exist. See the deadline note there.
 *
 * @returns {Promise<number>} how many jobs were expired
 */
export const expire_overdue_generation_jobs = async () =>
  db.transaction(async (trx) => {
    // A claimed row is locked by its drainer's transaction, and without this
    // the sweep BLOCKS on that lock until the drainer commits -- measured at
    // over five seconds behind a held claim. Since this now runs on the enqueue
    // path, blocking here would stall a user's request behind an unrelated
    // drainer. Skipping a locked row is correct: it is being worked on, and the
    // next enqueue sweeps it if it really is overdue.
    await trx.raw("SET LOCAL lock_timeout = '250ms'")
    try {
      return await trx('data_view_generation_jobs')
        .whereIn('status', LIVE_STATUSES)
        .where('deadline_at', '<', trx.fn.now())
        .update({
          status: 'expired',
          error_code: 'deadline_exceeded',
          error_message: 'the generation run passed its wall-clock deadline',
          completed_at: trx.fn.now()
        })
    } catch (error) {
      // 55P03 lock_not_available. Expiring is opportunistic maintenance, so a
      // contended sweep must never fail the enqueue that triggered it.
      if (error.code === '55P03') return 0
      throw error
    }
  })
