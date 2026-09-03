/* global describe, before, beforeEach, it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import db from '#db'
import {
  enqueue_generation_job,
  get_generation_job,
  claim_next_generation_job,
  mark_generation_job_running
} from '#libs-server/data-views/generation/generation-job-queue.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect

// The container's only write door.
//
// THE LOAD-BEARING CASES ARE THE REFUSALS, and each guards a different thing.
// A wrong thread_id must be refused because this route takes no JWT -- the
// container holds no league session and must not, so the thread id base minted
// and league recorded is the whole credential. A job that is no longer live
// must be refused because the credential is meant to spend once. And a bad
// emission must be refused HERE even though `emit` inside the container already
// validated it, because everything in this body is agent-controlled and the
// container's own verdict on its own output is not a control.

const valid_emission = {
  expressible: true,
  explanation: 'games played per player',
  inexpressible_reason: '',
  table_state: {
    row_grain: ['player'],
    prefix_columns: ['player_name'],
    columns: [{ column_id: 'player_games_played' }]
  }
}

const dispatch_one = async (thread_id = 'thread-emission-1') => {
  const { generation_id } = await enqueue_generation_job({
    instruction: 'games played by player',
    user_id: 1
  })
  await claim_next_generation_job()
  await mark_generation_job_running({ generation_id, thread_id })
  return generation_id
}

const post_emission = (body) =>
  chai_request
    .execute(server)
    .post('/api/data-views/generation-emission')
    .send(body)

describe('API POST /api/data-views/generation-emission', function () {
  this.timeout(30 * 1000)

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

  it('completes the job the thread id names, with no session of any kind', async function () {
    const generation_id = await dispatch_one()

    const res = await post_emission({
      thread_id: 'thread-emission-1',
      emission: valid_emission,
      tool_calls: ['search_columns', 'validate_table_state']
    })

    expect(res.status).to.equal(200)
    expect(res.body.generation_id).to.equal(generation_id)
    expect(res.body.branch).to.equal('registry')

    const job = await get_generation_job(generation_id)
    expect(job.status).to.equal('completed')
    expect(job.generation_branch).to.equal('registry')
    expect(job.result.table_state.columns[0].column_id).to.equal(
      'player_games_played'
    )
  })

  it('refuses a thread id that names no job', async function () {
    await dispatch_one()
    const res = await post_emission({
      thread_id: 'thread-that-is-not-ours',
      emission: valid_emission
    })
    expect(res.status).to.equal(404)
  })

  it('refuses a second emission on the same thread id', async function () {
    const generation_id = await dispatch_one()
    const first = await post_emission({
      thread_id: 'thread-emission-1',
      emission: valid_emission
    })
    expect(first.status).to.equal(200)

    // The credential spends once. Without this the same thread could overwrite
    // a delivered view for as long as the row existed.
    const second = await post_emission({
      thread_id: 'thread-emission-1',
      emission: {
        ...valid_emission,
        explanation: 'a second, different answer'
      }
    })
    expect(second.status).to.equal(404)

    const job = await get_generation_job(generation_id)
    expect(job.result.explanation).to.equal('games played per player')
  })

  it('refuses an emission that does not validate, and leaves the run alive', async function () {
    const generation_id = await dispatch_one()

    const res = await post_emission({
      thread_id: 'thread-emission-1',
      emission: {
        expressible: true,
        explanation: 'a fabricated column',
        inexpressible_reason: '',
        table_state: {
          row_grain: ['player'],
          prefix_columns: ['player_name'],
          columns: [{ column_id: 'player_vibes_rating' }]
        }
      }
    })

    expect(res.status).to.equal(400)
    expect(res.body.errors).to.be.an('array').that.is.not.empty

    // A rejected emission is a failed CLAIM, not a dead run: the agent still
    // holds its deadline and can emit something better.
    const job = await get_generation_job(generation_id)
    expect(job.status).to.equal('running')
  })

  it('refuses a request carrying no thread id', async function () {
    const res = await post_emission({ emission: valid_emission })
    expect(res.status).to.equal(400)
  })
})
