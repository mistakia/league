/* global describe, before, beforeEach, it */

import * as chai from 'chai'

import db from '#db'
import {
  MAX_QUEUE_DEPTH,
  JOB_DEADLINE_MS,
  GenerationQueueError,
  resolve_principal_key,
  enqueue_generation_job,
  get_generation_job,
  get_queue_depth,
  claim_next_generation_job,
  mark_generation_job_running,
  complete_generation_job,
  fail_generation_job,
  expire_overdue_generation_jobs
} from '#libs-server/data-views/generation/generation-job-queue.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// The transport's league-side half, against the real table.
//
// WHAT THIS FILE CAN AND CANNOT ESTABLISH. Everything here is behaviour of the
// job row and the queue discipline: the depth limit refusing, the claim being
// atomic, the deadline bounding a run nobody is watching, and a result staying
// collectable by generation_id after the client that asked for it is gone.
// Those are the transport's correctness claims that do not need a container.
//
// What it does NOT cover is the dispatch itself -- handing a claimed job to
// base's thread-creation queue and an agent actually running. That seam is one
// named adapter and nothing has exercised it, which is stated here rather than
// implied by a passing file.

const enqueue = (overrides = {}) =>
  enqueue_generation_job({
    instruction: 'top ten receivers by air yards',
    user_id: 1,
    ...overrides
  })

describe('data view generation queue', function () {
  this.timeout(30000)

  before(async function () {
    // The table is not in the suite's fixture set, so a missing one must fail
    // by name here rather than as a puzzling error inside the first case.
    const exists = await db.schema.hasTable('data_view_generation_jobs')
    expect(
      exists,
      'data_view_generation_jobs exists -- apply db/adhoc/2026-09-02-create-data-view-generation-jobs.sql'
    ).to.equal(true)
  })

  beforeEach(async function () {
    await db('data_view_generation_jobs').del()
  })

  describe('the principal key', function () {
    it('keys on the user when authenticated', function () {
      expect(resolve_principal_key({ user_id: 42 })).to.equal('user:42')
    })

    it('keys on the connecting ip when anonymous', function () {
      // The branch that is written now and left unreachable behind the
      // admission check. Exercised here precisely BECAUSE no route reaches it:
      // opening generation up later must be deleting an admission check, not
      // discovering that the anonymous path never worked.
      expect(resolve_principal_key({ connecting_ip: '203.0.113.7' })).to.equal(
        'ip:203.0.113.7'
      )
    })

    it('prefers the user over the ip, so an authenticated caller is never keyed by address', function () {
      expect(
        resolve_principal_key({ user_id: 42, connecting_ip: '203.0.113.7' })
      ).to.equal('user:42')
    })

    it('refuses when neither is available rather than inventing a shared bucket', async function () {
      // A fallback constant here would put every unidentifiable caller in ONE
      // bucket, which is the global-limit defect: one scripted client locks
      // everyone out.
      expect(() => resolve_principal_key({})).to.throw(/authenticated user/)
    })
  })

  describe('enqueue', function () {
    it('creates a queued job carrying an opaque id and a deadline', async function () {
      const job = await enqueue()

      expect(job.generation_id).to.be.a('string')
      expect(job.status).to.equal('queued')
      expect(job.principal_key).to.equal('user:1')
      expect(job.thread_id).to.equal(null)

      const deadline_in = new Date(job.deadline_at).getTime() - Date.now()
      expect(deadline_in).to.be.above(0)
      expect(deadline_in).to.be.at.most(JOB_DEADLINE_MS)
    })

    it('does not key the job on the user, so an anonymous job is a legal row', async function () {
      // The structural claim the whole design rests on: nothing that makes a
      // job work may require a user. If user_id were NOT NULL this insert
      // fails, and anonymous access becomes a schema change rather than the
      // deletion of an admission check.
      const job = await enqueue({ user_id: null, connecting_ip: '203.0.113.7' })
      expect(job.user_id).to.equal(null)
      expect(job.principal_key).to.equal('ip:203.0.113.7')
    })

    it('refuses an empty instruction by name', async function () {
      let error
      await enqueue({ instruction: '   ' }).catch((e) => {
        error = e
      })
      expect(error).to.be.instanceOf(GenerationQueueError)
      expect(error.code).to.equal('instruction_required')
    })
  })

  describe('the depth limit', function () {
    it('REFUSES above the stated depth rather than accepting an unbounded wait', async function () {
      // The failure tune-data-view-request-queue spent 24 steps deleting: a
      // silent unbounded wait behind a global processing flag. At the
      // concurrency the GPU permits, one ten-minute run makes every other
      // caller wait, so the queue has to say no.
      for (let i = 0; i < MAX_QUEUE_DEPTH; i++) await enqueue()
      expect(await get_queue_depth()).to.equal(MAX_QUEUE_DEPTH)

      let error
      await enqueue().catch((e) => {
        error = e
      })

      expect(error, 'the enqueue past the limit refused').to.be.instanceOf(
        GenerationQueueError
      )
      expect(error.code).to.equal('queue_full')
      // Reported, not just refused: a caller told only "no" cannot tell a full
      // queue from a broken one.
      expect(error.max_queue_depth).to.equal(MAX_QUEUE_DEPTH)
      expect(error.queue_depth).to.equal(MAX_QUEUE_DEPTH)
    })

    it('does not let STALLED jobs wedge the queue permanently', async function () {
      // The failure this exists to prevent: a job that dies in `running` holds
      // a slot forever, and MAX_QUEUE_DEPTH of them make the queue refuse every
      // request for every user, permanently, with no operator action possible
      // short of a manual UPDATE.
      //
      // The deadline is what bounds it, and a deadline nothing evaluates is not
      // a bound -- so enqueue sweeps before it counts. That is the whole reason
      // the bound needs no scheduler to exist.
      for (let i = 0; i < MAX_QUEUE_DEPTH; i++) await enqueue()
      await db('data_view_generation_jobs').update({
        status: 'running',
        deadline_at: new Date(Date.now() - 1000)
      })
      expect(
        await get_queue_depth(),
        'all slots held by stalled jobs'
      ).to.equal(MAX_QUEUE_DEPTH)

      const next = await enqueue()
      expect(next.status).to.equal('queued')
      expect(
        await get_queue_depth(),
        'the stalled jobs were reclaimed'
      ).to.equal(1)
    })

    it('counts only LIVE jobs, so a finished run frees its slot', async function () {
      // The control on the case above. If terminal jobs counted, the queue
      // would refuse forever after MAX_QUEUE_DEPTH lifetime requests -- and
      // the test above would pass just as happily.
      for (let i = 0; i < MAX_QUEUE_DEPTH; i++) await enqueue()

      const claimed = await claim_next_generation_job()
      await mark_generation_job_running({
        generation_id: claimed.generation_id,
        thread_id: 'thread-1'
      })
      await complete_generation_job({
        generation_id: claimed.generation_id,
        result: { expressible: true },
        generation_branch: 'registry'
      })

      expect(await get_queue_depth()).to.equal(MAX_QUEUE_DEPTH - 1)
      const next = await enqueue()
      expect(next.status).to.equal('queued')
    })
  })

  describe('the claim', function () {
    it('takes the oldest queued job and marks it dispatched', async function () {
      const first = await enqueue({ instruction: 'first' })
      await enqueue({ instruction: 'second' })

      const claimed = await claim_next_generation_job()
      expect(claimed.generation_id).to.equal(first.generation_id)
      expect(claimed.status).to.equal('dispatched')
      expect(claimed.dispatched_at).to.not.equal(null)
    })

    it('never hands the same job to two drainers', async function () {
      // A REAL race, held open by a transaction. Two claims fired with
      // Promise.all on the same pool do NOT test this: they serialize, the
      // second finds no queued row, and the case passes whether or not either
      // guard exists. That version of this test was written first and was
      // vacuous -- removing FOR UPDATE SKIP LOCKED left it green.
      //
      // So drainer A claims inside an open transaction and HOLDS the row lock,
      // and drainer B claims on a separate connection while that lock is held.
      // B must come back empty rather than blocking or double-claiming.
      await enqueue({ instruction: 'only one' })

      const claimed = []
      await db.transaction(async (trx) => {
        const a = await claim_next_generation_job(trx)
        if (a) claimed.push(a)

        // A short timeout so the "it blocked" failure mode reports as a
        // timeout here rather than hanging the suite: with SKIP LOCKED, B
        // returns immediately; without it, B waits on A's lock.
        const b = await db.transaction(async (other) => {
          await other.raw("SET LOCAL lock_timeout = '2s'")
          return claim_next_generation_job(other)
        })
        if (b) claimed.push(b)
      })

      expect(claimed.length, 'exactly one drainer got the job').to.equal(1)
    })

    it('returns undefined on an empty queue rather than throwing', async function () {
      expect(await claim_next_generation_job()).to.equal(undefined)
    })
  })

  describe('reconnect and collect', function () {
    it('serves the finished view to a caller holding only the generation_id', async function () {
      // The reason the job is keyed on an opaque id at all. The client that
      // asked is gone; a new one arrives with nothing but the id and must get
      // the result.
      const job = await enqueue()
      const claimed = await claim_next_generation_job()
      await mark_generation_job_running({
        generation_id: claimed.generation_id,
        thread_id: 'thread-9'
      })
      await complete_generation_job({
        generation_id: job.generation_id,
        result: {
          expressible: true,
          table_state: { columns: ['player_name'] }
        },
        generation_branch: 'registry',
        trajectory: { tool_call_count: 11, total_tokens: 40312 }
      })

      const collected = await get_generation_job(job.generation_id)
      expect(collected.status).to.equal('completed')
      expect(collected.result.table_state.columns).to.eql(['player_name'])
      expect(collected.generation_branch).to.equal('registry')
      expect(collected.tool_call_count).to.equal(11)
      expect(collected.total_tokens).to.equal(40312)
      expect(collected.duration_milliseconds).to.be.a('number')
    })

    it('records a refusal as COMPLETED, not as a failure', async function () {
      // A refusal is a legitimate outcome the refusal-rate metric is computed
      // over. Filing it as a failure folds it in with the provider being
      // unreachable and makes both numbers meaningless.
      const job = await enqueue()
      await complete_generation_job({
        generation_id: job.generation_id,
        result: {
          expressible: false,
          inexpressible_reason: 'no column carries snap-weighted air yards'
        },
        generation_branch: 'refusal'
      })

      const collected = await get_generation_job(job.generation_id)
      expect(collected.status).to.equal('completed')
      expect(collected.generation_branch).to.equal('refusal')
      expect(collected.error_code).to.equal(null)
    })

    it('records a real failure with a named code', async function () {
      const job = await enqueue()
      await fail_generation_job({
        generation_id: job.generation_id,
        error_code: 'session_start_failed',
        error_message: 'the container refused the session'
      })

      const collected = await get_generation_job(job.generation_id)
      expect(collected.status).to.equal('failed')
      expect(collected.error_code).to.equal('session_start_failed')
    })
  })

  describe('the deadline', function () {
    it('expires a live job past its deadline, so a disconnect cannot leave one running forever', async function () {
      // The socket cannot be this bound. A disconnect must NOT cancel a job
      // the client can still collect by generation_id, so "the client went
      // away" and "the run should stop" are different events -- and this sweep
      // is the second one. It holds whether or not anyone is connected.
      const job = await enqueue()
      await db('data_view_generation_jobs')
        .where({ generation_id: job.generation_id })
        .update({ deadline_at: new Date(Date.now() - 1000) })

      const expired = await expire_overdue_generation_jobs()
      expect(expired).to.equal(1)

      const collected = await get_generation_job(job.generation_id)
      expect(collected.status).to.equal('expired')
      expect(collected.error_code).to.equal('deadline_exceeded')
    })

    it('RESTARTS when the run begins, so queue wait does not eat the run budget', async function () {
      // Measured 2026-09-04: a job sat twelve minutes behind a wedged session
      // slot, dispatched with three minutes left on an enqueue-relative
      // deadline, and was killed mid-work having already found the right
      // column. The deadline bounds the agent, and the agent starts here.
      const job = await enqueue()
      await claim_next_generation_job()

      // Age the row as a long queue wait would: nearly the whole budget gone
      // before the agent exists.
      const nearly_spent = new Date(Date.now() + 30 * 1000)
      await db('data_view_generation_jobs')
        .where({ generation_id: job.generation_id })
        .update({ deadline_at: nearly_spent })

      await mark_generation_job_running({
        generation_id: job.generation_id,
        thread_id: 'thread-deadline'
      })

      const running = await get_generation_job(job.generation_id)
      const remaining_ms = new Date(running.deadline_at).getTime() - Date.now()
      // The whole budget back, not the 30 seconds the row carried.
      expect(remaining_ms).to.be.greaterThan(JOB_DEADLINE_MS - 60 * 1000)
      expect(remaining_ms).to.be.at.most(JOB_DEADLINE_MS + 60 * 1000)
    })

    it('leaves a QUEUED job on its enqueue-relative deadline', async function () {
      // The control for the test above, and the property that keeps "queued
      // forever" impossible: only a job that actually started gets a fresh
      // budget. A row that never dispatches is still swept.
      const job = await enqueue()
      await db('data_view_generation_jobs')
        .where({ generation_id: job.generation_id })
        .update({ deadline_at: new Date(Date.now() - 1000) })

      expect(await expire_overdue_generation_jobs()).to.equal(1)
      expect((await get_generation_job(job.generation_id)).status).to.equal(
        'expired'
      )
    })

    it('leaves a job INSIDE its deadline alone', async function () {
      // The control. A sweep that expired everything would satisfy the case
      // above and destroy every run in flight.
      const job = await enqueue()
      expect(await expire_overdue_generation_jobs()).to.equal(0)
      expect((await get_generation_job(job.generation_id)).status).to.equal(
        'queued'
      )
    })

    it('does not resurrect a job that already finished', async function () {
      const job = await enqueue()
      await complete_generation_job({
        generation_id: job.generation_id,
        result: { expressible: true },
        generation_branch: 'registry'
      })
      await db('data_view_generation_jobs')
        .where({ generation_id: job.generation_id })
        .update({ deadline_at: new Date(Date.now() - 1000) })

      expect(await expire_overdue_generation_jobs()).to.equal(0)
      expect((await get_generation_job(job.generation_id)).status).to.equal(
        'completed'
      )
    })
  })
})
