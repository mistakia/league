/* global describe, before, beforeEach, it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

import server from '#api'
import knex from '#db'
import get_data_view_notices from '#app/core/data-views/data-view-notices.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect

// Provenance on a saved view: whether an agent built it, and by what.
//
// THE PROPERTY WORTH GUARDING IS THAT IT IS RESOLVED, NOT ASSERTED. The client
// names a generation; the server reads the timestamp and the provider off that
// job row. If the client could supply the timestamp, the field would be a claim
// nobody could check -- and it exists precisely so a reader can tell a
// generated view from a hand-built one. So the load-bearing cases are the two
// where a caller names a generation that is not theirs to name.

const get_token = async (email, password) => {
  const res = await chai_request
    .execute(server)
    .post('/api/auth/login')
    .send({ email_or_username: email, password })
  return res.body.token
}

const table_state = { columns: ['player_name'], where: [], sort: [] }

describe('data view generation provenance', function () {
  this.timeout(30 * 1000)

  let token
  let user_id
  let other_user_id

  before(async function () {
    await knex('data_view_generation_jobs').del()
    await knex('user_data_view_favorites').del()
    await knex('user_data_view_tags').del()
    await knex('user_data_views').del()
    await knex('users').del()

    const salt = await bcrypt.genSalt(10)
    const [owner] = await knex('users')
      .insert({
        email: 'provenance@test.com',
        username: 'provenance',
        password: await bcrypt.hash('provenancepass', salt)
      })
      .returning('id')
    const [other] = await knex('users')
      .insert({
        email: 'provenance-other@test.com',
        username: 'provenanceother',
        password: await bcrypt.hash('otherpass', salt)
      })
      .returning('id')

    user_id = owner.id || owner
    other_user_id = other.id || other
    token = await get_token('provenance@test.com', 'provenancepass')
    expect(token, 'the spec needs a session to save a view at all').to.be.a(
      'string'
    )
  })

  beforeEach(async function () {
    await knex('user_data_views').del()
    await knex('data_view_generation_jobs').del()
  })

  const insert_job = async ({
    owner_id = user_id,
    status = 'completed',
    inference_provider = 'vllm-deepseek-v4-flash'
  } = {}) => {
    const [job] = await knex('data_view_generation_jobs')
      .insert({
        principal_key: `user:${owner_id}`,
        user_id: owner_id,
        instruction: 'top receivers by receiving yards',
        status,
        inference_provider,
        completed_at: knex.fn.now()
      })
      .returning('*')
    return job
  }

  const save_view = (body) =>
    chai_request
      .execute(server)
      .post('/api/data-views')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_generated_view_id: crypto.randomUUID(),
        view_name: 'A view',
        view_description: 'a description, since the validator requires one',
        table_state,
        ...body
      })

  it('stamps the generation job time and provider onto the saved view', async function () {
    const job = await insert_job()
    const res = await save_view({ generation_id: job.generation_id })

    expect(res.status).to.equal(200)
    expect(res.body.llm_generated_at).to.not.equal(null)
    expect(res.body.llm_inference_provider).to.equal('vllm-deepseek-v4-flash')
  })

  it('leaves a hand-built view carrying neither field', async function () {
    // The other half of the notice's contract: a manually built view must not
    // render the generated notice.
    const res = await save_view({})
    expect(res.status).to.equal(200)
    expect(res.body.llm_generated_at).to.equal(null)
    expect(res.body.llm_inference_provider).to.equal(null)
  })

  it('stamps nothing when the generation belongs to someone else', async function () {
    const job = await insert_job({ owner_id: other_user_id })
    const res = await save_view({ generation_id: job.generation_id })

    expect(res.status).to.equal(200)
    expect(res.body.llm_generated_at).to.equal(null)
  })

  it('stamps nothing for a generation that has not finished', async function () {
    // A running job has produced nothing yet, so claiming it as the origin of
    // this table_state would be false -- whatever the client currently holds
    // came from somewhere else.
    const job = await insert_job({ status: 'running' })
    const res = await save_view({ generation_id: job.generation_id })

    expect(res.status).to.equal(200)
    expect(res.body.llm_generated_at).to.equal(null)
  })

  it('saves rather than fails when the generation id resolves to nothing', async function () {
    // A save must not fail because a generation expired while the user was
    // still editing what it produced. No provenance is the right answer; a 400
    // would lose their work.
    const res = await save_view({ generation_id: crypto.randomUUID() })
    expect(res.status).to.equal(200)
    expect(res.body.llm_generated_at).to.equal(null)
  })

  it('keeps provenance across a later hand-edit and save', async function () {
    const job = await insert_job()
    const first = await save_view({ generation_id: job.generation_id })
    expect(first.body.llm_generated_at).to.not.equal(null)

    // Saved again with no generation_id -- the user edited by hand. Provenance
    // records where a view CAME FROM, and a later edit does not make it stop
    // having been generated.
    const second = await chai_request
      .execute(server)
      .post('/api/data-views')
      .set('Authorization', `Bearer ${token}`)
      .send({
        view_id: first.body.view_id,
        view_name: 'A view, edited',
        view_description: 'a description, since the validator requires one',
        table_state: {
          columns: ['player_name', 'player_position'],
          where: [],
          sort: []
        }
      })

    expect(second.status).to.equal(200)
    expect(second.body.llm_generated_at).to.not.equal(null)
  })

  describe('the generated-view notice', function () {
    it('fires on a view carrying llm_generated_at', function () {
      const notices = get_data_view_notices({
        where: [],
        columns: ['player_name'],
        llm_generated_at: '2026-09-03T04:00:00.000Z'
      })
      expect(notices.map((n) => n.code)).to.include('view_generated_by_llm')
    })

    it('does not fire on a hand-built view', function () {
      // The negative control. Without it the assertion above could be passing
      // on a rule that fires unconditionally.
      const notices = get_data_view_notices({
        where: [],
        columns: ['player_name']
      })
      expect(notices.map((n) => n.code)).to.not.include('view_generated_by_llm')
    })
  })
})
