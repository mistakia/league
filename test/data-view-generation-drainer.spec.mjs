/* global describe, before, beforeEach, it */

import * as chai from 'chai'

import db from '#db'
import {
  enqueue_generation_job,
  get_generation_job,
  get_queue_depth
} from '#libs-server/data-views/generation/generation-job-queue.mjs'
import {
  drain_once,
  is_retryable_dispatch_failure
} from '#libs-server/data-views/generation/generation-drainer.mjs'
import {
  BaseSessionError,
  build_generation_prompt
} from '#libs-server/data-views/generation/base-session-client.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// The dispatch seam: a claimed league job becoming a container session on
// base's rail.
//
// THE DISPATCH ITSELF IS INJECTED, and that is the honest boundary rather than
// a convenience. What this file owns is league's state machine around the
// dispatch -- which status a job lands in for each answer base can give, and
// which answers return it to the queue instead of killing it. Whether base
// actually accepts the POST is a property of a running fleet, a live tenant
// container and a resident model; asserting it against a stub would be the
// mock-the-runtime anti-pattern, and it would pass hardest in exactly the case
// the rail is down.
//
// The live half is verified out of band against base-api and recorded on
// user:task/league/data-views/add-llm-assisted-view-generation.md.

const enqueue = (overrides = {}) =>
  enqueue_generation_job({
    instruction: 'top ten receivers by air yards',
    user_id: 1,
    ...overrides
  })

const accepting_dispatch = (thread_id = 'thread-1') => {
  const calls = []
  const dispatch = async (params) => {
    calls.push(params)
    return { thread_id, job_id: 'base-job-1' }
  }
  dispatch.calls = calls
  return dispatch
}

const refusing_dispatch = (error) => async () => {
  throw error
}

describe('data view generation drainer', function () {
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

  describe('an empty queue', function () {
    it('drains nothing and does not dispatch', async function () {
      const dispatch = accepting_dispatch()
      const result = await drain_once({ dispatch })
      expect(result.drained).to.equal(false)
      expect(dispatch.calls).to.have.lengthOf(0)
    })
  })

  describe('a successful dispatch', function () {
    it('moves the job to running and records base thread id', async function () {
      const { generation_id } = await enqueue()
      const dispatch = accepting_dispatch('thread-abc')

      const result = await drain_once({ dispatch })

      expect(result.outcome).to.equal('running')
      const job = await get_generation_job(generation_id)
      expect(job.status).to.equal('running')
      expect(job.thread_id).to.equal('thread-abc')
      expect(job.started_at).to.not.equal(null)
      expect(job.dispatched_at).to.not.equal(null)
    })

    it('hands the dispatch the instruction and the edit-case table_state', async function () {
      const input_table_state = { columns: ['player_name'] }
      const { generation_id } = await enqueue({
        instruction: 'add air yards',
        input_table_state
      })
      const dispatch = accepting_dispatch()

      await drain_once({ dispatch })

      expect(dispatch.calls).to.have.lengthOf(1)
      expect(dispatch.calls[0].generation_id).to.equal(generation_id)
      expect(dispatch.calls[0].instruction).to.equal('add air yards')
      expect(dispatch.calls[0].input_table_state).to.deep.equal(
        input_table_state
      )
    })

    it('takes exactly ONE job per pass, since the profile permits one session', async function () {
      await enqueue({ instruction: 'first' })
      await enqueue({ instruction: 'second' })
      const dispatch = accepting_dispatch()

      await drain_once({ dispatch })

      expect(dispatch.calls).to.have.lengthOf(1)
      const still_queued = await db('data_view_generation_jobs').where({
        status: 'queued'
      })
      expect(still_queued).to.have.lengthOf(1)
      expect(still_queued[0].instruction).to.equal('second')
    })
  })

  describe('a capacity refusal', function () {
    // THE LOAD-BEARING CASE. Base answers 429 whenever the profile's one
    // session slot is occupied, which at the concurrency a single GPU tenant
    // permits is the ordinary answer rather than an error. Failing the row for
    // it would show a user a dead generation for a wait of seconds.
    it('returns the job to the QUEUE rather than failing it', async function () {
      const { generation_id } = await enqueue()

      const result = await drain_once({
        dispatch: refusing_dispatch(
          new BaseSessionError('base_capacity_reached', 'one session allowed')
        )
      })

      expect(result.outcome).to.equal('released')
      const job = await get_generation_job(generation_id)
      expect(job.status).to.equal('queued')
      expect(job.error_code).to.equal(null)
      // Cleared with the status: a released job must be indistinguishable from
      // one never claimed, or the audit record reads as though the run began.
      expect(job.dispatched_at).to.equal(null)
    })

    it('leaves the released job at the HEAD of the queue, so it cannot starve', async function () {
      const first = await enqueue({ instruction: 'first' })
      await enqueue({ instruction: 'second' })

      await drain_once({
        dispatch: refusing_dispatch(
          new BaseSessionError('base_capacity_reached', 'busy')
        )
      })

      // The next pass must take the SAME job back, not the one behind it.
      const dispatch = accepting_dispatch()
      await drain_once({ dispatch })
      expect(dispatch.calls[0].generation_id).to.equal(first.generation_id)
    })

    it('treats an unreadable container count as retryable too', async function () {
      const { generation_id } = await enqueue()
      await drain_once({
        dispatch: refusing_dispatch(
          new BaseSessionError('base_container_unreadable', 'restarting')
        )
      })
      const job = await get_generation_job(generation_id)
      expect(job.status).to.equal('queued')
    })
  })

  describe('a terminal refusal', function () {
    // THE NEGATIVE CONTROL for the case above. If everything were retryable the
    // capacity test would pass for the wrong reason, and a misconfigured key
    // would spin the drainer against the same error until the deadline.
    it('FAILS the job with its named code rather than re-queueing forever', async function () {
      const { generation_id } = await enqueue()

      const result = await drain_once({
        dispatch: refusing_dispatch(
          new BaseSessionError(
            'identity_key_malformed',
            'the generation identity key is not 64 hex characters'
          )
        )
      })

      expect(result.outcome).to.equal('failed')
      const job = await get_generation_job(generation_id)
      expect(job.status).to.equal('failed')
      expect(job.error_code).to.equal('identity_key_malformed')
      expect(job.error_message).to.include('64 hex characters')
      expect(job.completed_at).to.not.equal(null)
    })

    it('fails a plain Error too, rather than mistaking it for capacity', async function () {
      const { generation_id } = await enqueue()
      await drain_once({
        dispatch: refusing_dispatch(new Error('socket hang up'))
      })
      const job = await get_generation_job(generation_id)
      expect(job.status).to.equal('failed')
      expect(job.error_code).to.equal('dispatch_failed')
    })

    it('frees the queue slot, so a failed job does not hold depth', async function () {
      await enqueue()
      await drain_once({
        dispatch: refusing_dispatch(new Error('socket hang up'))
      })
      expect(await get_queue_depth()).to.equal(0)
    })
  })

  describe('is_retryable_dispatch_failure', function () {
    it('is true for exactly the two transient codes', function () {
      expect(
        is_retryable_dispatch_failure(
          new BaseSessionError('base_capacity_reached', 'x')
        )
      ).to.equal(true)
      expect(
        is_retryable_dispatch_failure(
          new BaseSessionError('base_container_unreadable', 'x')
        )
      ).to.equal(true)
    })

    it('is false for a configuration error and for a bare Error', function () {
      expect(
        is_retryable_dispatch_failure(
          new BaseSessionError('base_api_url_unset', 'x')
        )
      ).to.equal(false)
      expect(is_retryable_dispatch_failure(new Error('x'))).to.equal(false)
    })
  })

  describe('the prompt handed to the agent', function () {
    it('carries the instruction and nothing procedural', function () {
      const prompt = build_generation_prompt({
        instruction: 'top ten receivers by air yards'
      })
      expect(prompt).to.equal('top ten receivers by air yards')
    })

    it('names the edit case explicitly and asks for a COMPLETE replacement', function () {
      const prompt = build_generation_prompt({
        instruction: 'add air yards',
        input_table_state: { columns: ['player_name'] }
      })
      expect(prompt).to.include('add air yards')
      expect(prompt).to.include('EDIT')
      expect(prompt).to.include('complete replacement, not a patch')
      expect(prompt).to.include('"player_name"')
    })
  })
})
