/* global describe, before, beforeEach, it */

import * as chai from 'chai'

import db from '#db'
import {
  enqueue_generation_job,
  get_generation_job,
  claim_next_generation_job,
  mark_generation_job_running,
  complete_generation_job
} from '#libs-server/data-views/generation/generation-job-queue.mjs'
import {
  collect_job,
  collect_once,
  derive_total_tokens,
  select_collectable_jobs
} from '#libs-server/data-views/generation/generation-collector.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// What league learns about a run it does not operate.
//
// THE THREAD READ IS INJECTED, for the same reason the drainer spec injects its
// dispatch: whether base serves a thread is a property of a running fleet, and
// asserting it against a stub would pass hardest when the rail is down. What
// this file owns is the STATE MACHINE on league's side -- which job rows get
// asked about, what a terminal session does to a live row, and that a
// trajectory is written once and only when it is final.
//
// The load-bearing case is the last one in each group: a run that ends without
// emitting must not sit in `running` until its 15-minute deadline, because at a
// depth limit of 8 that is a queue slot held for a run that is already over.

const ended_thread = (overrides = {}) => ({
  thread_id: 'thread-1',
  session_status: 'ended',
  tool_call_count: 12,
  cumulative_input_tokens: 100,
  cumulative_output_tokens: 900,
  cumulative_cache_creation_input_tokens: 4000,
  cumulative_cache_read_input_tokens: 20000,
  ...overrides
})

const reader = (thread) => async () => thread

const dispatch_one = async (overrides = {}) => {
  const { generation_id } = await enqueue_generation_job({
    instruction: 'top ten receivers by air yards',
    user_id: 1,
    ...overrides
  })
  await claim_next_generation_job()
  await mark_generation_job_running({ generation_id, thread_id: 'thread-1' })
  return generation_id
}

describe('data view generation collector', function () {
  this.timeout(30000)

  before(async function () {
    const exists = await db.schema.hasTable('data_view_generation_jobs')
    expect(
      exists,
      'data_view_generation_jobs exists -- apply db/adhoc/2026-09-02-create-data-view-generation-jobs.sql'
    ).to.equal(true)
  })

  beforeEach(async function () {
    await db('data_view_generation_jobs').del()
  })

  describe('total tokens', function () {
    it('sums the cumulative counters rather than taking the reported total', function () {
      // provider_metadata.total_tokens is present and reads 0 on a live thread,
      // so taking it would record every run as free. The negative control is
      // the point: the reported 0 is on the object and is NOT what comes back.
      const total = derive_total_tokens(
        ended_thread({
          external_session: { provider_metadata: { total_tokens: 0 } }
        })
      )
      expect(total).to.equal(25000)
    })

    it('falls back to the reported total when no cumulative counter is present', function () {
      const total = derive_total_tokens({
        session_status: 'ended',
        external_session: { provider_metadata: { total_tokens: 4242 } }
      })
      expect(total).to.equal(4242)
    })

    it('reports null rather than zero when the thread carries no counts', function () {
      // Null and zero are different claims: zero says the run called nothing,
      // null says nobody knows.
      expect(derive_total_tokens({ session_status: 'ended' })).to.equal(null)
    })
  })

  describe('selecting what to ask about', function () {
    it('asks about a running job', async function () {
      await dispatch_one()
      const jobs = await select_collectable_jobs()
      expect(jobs).to.have.lengthOf(1)
    })

    it('asks about a finished job whose trajectory was never recorded', async function () {
      const generation_id = await dispatch_one()
      await complete_generation_job({
        generation_id,
        result: { expressible: true },
        generation_branch: 'registry'
      })
      const jobs = await select_collectable_jobs()
      expect(jobs).to.have.lengthOf(1)
      expect(jobs[0].status).to.equal('completed')
    })

    it('stops asking once the trajectory is recorded AND the session is torn down', async function () {
      const generation_id = await dispatch_one()
      await complete_generation_job({
        generation_id,
        result: { expressible: true },
        generation_branch: 'registry',
        trajectory: { tool_call_count: 9, total_tokens: 100 }
      })

      // A trajectory alone no longer retires a job. The session behind it can
      // still be sitting at an idle prompt, and that is the more expensive of
      // the two things left outstanding.
      expect(await select_collectable_jobs()).to.have.lengthOf(1)

      await db('data_view_generation_jobs')
        .where({ generation_id })
        .update({ session_termination_requested_at: db.fn.now() })
      expect(await select_collectable_jobs()).to.have.lengthOf(0)
    })

    it('never asks about a job that was never dispatched', async function () {
      // A queued job has no thread to read, and asking base about a null
      // thread_id would be a request that cannot succeed.
      await enqueue_generation_job({ instruction: 'top receivers', user_id: 1 })
      expect(await select_collectable_jobs()).to.have.lengthOf(0)
    })
  })

  describe('a session that is still going', function () {
    it('records nothing, so a partial count cannot stand as the final one', async function () {
      const generation_id = await dispatch_one()
      const result = await collect_job({
        job: await get_generation_job(generation_id),
        read_thread: reader(
          ended_thread({ session_status: 'running', tool_call_count: 4 })
        )
      })
      expect(result.outcome).to.equal('running')
      const job = await get_generation_job(generation_id)
      expect(job.status).to.equal('running')
      // Writing 4 here would satisfy the `tool_call_count IS NULL` predicate
      // the selector uses, so the job would never be revisited and 4 would be
      // its recorded cost forever.
      expect(job.tool_call_count).to.equal(null)
    })
  })

  describe('a session that ended without emitting', function () {
    it('fails the job by name instead of leaving it to the deadline', async function () {
      const generation_id = await dispatch_one()
      const result = await collect_job({
        job: await get_generation_job(generation_id),
        read_thread: reader(ended_thread())
      })
      expect(result.outcome).to.equal('failed')
      const job = await get_generation_job(generation_id)
      expect(job.status).to.equal('failed')
      expect(job.error_code).to.equal('agent_ended_without_emission')
      // The cost is recorded even though nothing was produced. A failed run's
      // cost is the one most worth having.
      expect(job.tool_call_count).to.equal(12)
      expect(job.total_tokens).to.equal(25000)
    })

    it('names a failed harness apart from an agent that simply stopped', async function () {
      const generation_id = await dispatch_one()
      await collect_job({
        job: await get_generation_job(generation_id),
        read_thread: reader(ended_thread({ session_status: 'failed' }))
      })
      const job = await get_generation_job(generation_id)
      expect(job.error_code).to.equal('agent_session_failed')
    })

    it('fails a live job whose thread base has never heard of', async function () {
      const generation_id = await dispatch_one()
      await collect_job({
        job: await get_generation_job(generation_id),
        read_thread: async () => null
      })
      const job = await get_generation_job(generation_id)
      expect(job.status).to.equal('failed')
      expect(job.error_code).to.equal('agent_session_missing')
    })
  })

  describe('a session that emitted', function () {
    it('attaches the trajectory without disturbing the completed job', async function () {
      const generation_id = await dispatch_one()
      // The emission arrives by push while the row is running, which is what
      // closes it -- league does not know the cost at that moment.
      await complete_generation_job({
        generation_id,
        result: { expressible: true, table_state: { columns: ['a'] } },
        generation_branch: 'registry'
      })

      const { collected } = await collect_once({
        read_thread: reader(ended_thread())
      })
      expect(collected).to.equal(1)

      const job = await get_generation_job(generation_id)
      expect(job.status).to.equal('completed')
      expect(job.generation_branch).to.equal('registry')
      expect(job.tool_call_count).to.equal(12)
      expect(job.total_tokens).to.equal(25000)
      // complete_generation_job derived this in SQL across both ends of the
      // interval on the server clock; the collector must not overwrite it with
      // a figure measured on another host.
      expect(job.duration_milliseconds).to.not.equal(null)
    })
  })

  // Tearing the agent session down when the job is terminal.
  //
  // The load-bearing case is the FIRST one: base launches every generation as an
  // interactive REPL and retired its headless one-shot, so a healthy agent that
  // has answered sits at awaiting_user forever. That is not a terminal session
  // status, so without this teardown the trajectory gate never opens and a
  // successful run records no cost at all -- which is exactly what production
  // did on 2026-09-03.
  describe('tearing down the session behind a terminal job', function () {
    const recording_killer = (result = { killed: true, reason: 'ok' }) => {
      const calls = []
      return {
        calls,
        kill_session: async ({ thread_id }) => {
          calls.push(thread_id)
          return result
        }
      }
    }

    it('kills the session and stamps the attempt', async function () {
      const generation_id = await dispatch_one()
      await complete_generation_job({
        generation_id,
        result: { table_state: {} },
        generation_branch: 'registry'
      })
      const { calls, kill_session } = recording_killer()

      await collect_job({
        job: await get_generation_job(generation_id),
        read_thread: reader(ended_thread({ session_status: 'awaiting_user' })),
        kill_session
      })

      expect(calls).to.deep.equal(['thread-1'])
      const job = await get_generation_job(generation_id)
      expect(job.session_termination_requested_at).to.not.equal(null)
    })

    it('kills it even when the thread read THROWS, which is the runaway case', async function () {
      // The ordering defect this covers: read_thread used to run first, so an
      // unreachable base skipped the teardown entirely and collect_once
      // swallowed the throw. The run it was meant to stop kept going, kept
      // spending, and held the profile's only session slot -- so every later
      // generation sat queued and expired without dispatching. Base being
      // unreadable is exactly when a teardown matters most, so it must not be
      // the condition that disarms it.
      const generation_id = await dispatch_one()
      await complete_generation_job({
        generation_id,
        result: { table_state: {} },
        generation_branch: 'registry'
      })
      const { calls, kill_session } = recording_killer()

      let threw = false
      try {
        await collect_job({
          job: await get_generation_job(generation_id),
          read_thread: async () => {
            throw new Error('base refused a thread read with 503')
          },
          kill_session
        })
      } catch (error) {
        threw = true
      }

      // The read still throws — collect_once is what swallows it per job, and
      // this asserts the kill happened BEFORE the throw rather than that the
      // throw went away.
      expect(threw).to.equal(true)
      expect(calls).to.deep.equal(['thread-1'])
      const job = await get_generation_job(generation_id)
      expect(job.session_termination_requested_at).to.not.equal(null)
    })

    it('does not kill it twice, however many passes run', async function () {
      const generation_id = await dispatch_one()
      await complete_generation_job({
        generation_id,
        result: { table_state: {} },
        generation_branch: 'registry'
      })
      const { calls, kill_session } = recording_killer()

      // Three passes stands in for the 720 a 5-second drainer would make across
      // the one-hour trajectory window.
      for (let i = 0; i < 3; i++) {
        await collect_job({
          job: await get_generation_job(generation_id),
          read_thread: reader(
            ended_thread({ session_status: 'awaiting_user' })
          ),
          kill_session
        })
      }

      expect(calls).to.deep.equal(['thread-1'])
    })

    it('stamps even when base REFUSES, since a retried refusal is the same runaway', async function () {
      const generation_id = await dispatch_one()
      await complete_generation_job({
        generation_id,
        result: { table_state: {} },
        generation_branch: 'registry'
      })
      const { calls, kill_session } = recording_killer({
        killed: false,
        reason: 'base answered 503'
      })

      await collect_job({
        job: await get_generation_job(generation_id),
        read_thread: reader(ended_thread({ session_status: 'awaiting_user' })),
        kill_session
      })
      await collect_job({
        job: await get_generation_job(generation_id),
        read_thread: reader(ended_thread({ session_status: 'awaiting_user' })),
        kill_session
      })

      expect(calls).to.deep.equal(['thread-1'])
      const job = await get_generation_job(generation_id)
      expect(job.session_termination_requested_at).to.not.equal(null)
    })

    // The negative control: a run still in flight must keep its session.
    it('leaves a LIVE job alone', async function () {
      const generation_id = await dispatch_one()
      const { calls, kill_session } = recording_killer()

      await collect_job({
        job: await get_generation_job(generation_id),
        read_thread: reader(ended_thread({ session_status: 'awaiting_user' })),
        kill_session
      })

      expect(calls).to.deep.equal([])
      const job = await get_generation_job(generation_id)
      expect(job.session_termination_requested_at).to.equal(null)
    })

    it('picks up a terminal job that owes only a teardown', async function () {
      const generation_id = await dispatch_one()
      await complete_generation_job({
        generation_id,
        result: { table_state: {} },
        generation_branch: 'registry'
      })
      // Trajectory already recorded, so the old selection would have dropped it.
      await db('data_view_generation_jobs')
        .where({ generation_id })
        .update({ tool_call_count: 9 })

      const rows = await select_collectable_jobs()
      expect(rows.map((r) => r.generation_id)).to.include(generation_id)
    })
  })
})
