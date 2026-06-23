/* global describe, before, it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import bcrypt from 'bcrypt'

import server from '#api'
import knex from '#db'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()

const expect = chai.expect

// Helper: get JWT token for a test user
async function get_token(email, password) {
  const res = await chai_request
    .execute(server)
    .post('/api/auth/login')
    .send({ email_or_username: email, password })
  return res.body.token
}

const valid_table_state = { columns: ['player_name'] }

// Regression coverage for the shared /u/<hash> short-URL save bug: opening a
// shared view hydrates client state with a view_id that does not resolve to a
// row owned by the saver (a never-persisted client-generated id, or another
// user's view). Saving such a view must fork into a new view owned by the
// saver rather than fail with "invalid view_id" / "invalid userId".
describe('Save data/plays view forks non-owned view_id', function () {
  this.timeout(20000)
  let token1
  let user1_id
  let user2_id

  before(async function () {
    await knex('user_data_view_favorites').del()
    await knex('user_data_view_tags').del()
    await knex('user_data_views').del()
    await knex('user_plays_views').del()
    await knex('users').del()
    await knex.raw('ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1')

    const salt = await bcrypt.genSalt(10)
    const pw1 = await bcrypt.hash('forktest1', salt)
    const pw2 = await bcrypt.hash('forktest2', salt)

    const [u1] = await knex('users')
      .insert({
        email: 'forktest1@test.com',
        username: 'forktest1',
        password: pw1
      })
      .returning('id')
    const [u2] = await knex('users')
      .insert({
        email: 'forktest2@test.com',
        username: 'forktest2',
        password: pw2
      })
      .returning('id')

    user1_id = u1.id || u1
    user2_id = u2.id || u2

    token1 = await get_token('forktest1@test.com', 'forktest1')
  })

  describe('POST /api/data-views', function () {
    it('forks into a new owned view when view_id does not exist', async function () {
      const bogus_view_id = 'ff5d37b0-4471-4a67-84b9-ba33ea6965ea'
      const res = await chai_request
        .execute(server)
        .post('/api/data-views')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          view_id: bogus_view_id,
          view_name: 'Forked From Share Link',
          view_description: 'opened via /u/<hash>',
          table_state: valid_table_state
        })

      res.should.have.status(200)
      expect(res.body.view_id).to.not.equal(bogus_view_id)
      expect(res.body.user_id).to.equal(user1_id)

      const orphan = await knex('user_data_views')
        .where({ view_id: bogus_view_id })
        .first()
      expect(orphan).to.equal(undefined)
    })

    it("forks another user's view rather than rejecting with 401", async function () {
      const foreign_view_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      await knex('user_data_views').insert({
        view_id: foreign_view_id,
        user_id: user2_id,
        view_name: 'User2 Original',
        view_description: 'belongs to user2',
        table_state: JSON.stringify(valid_table_state)
      })

      const res = await chai_request
        .execute(server)
        .post('/api/data-views')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          view_id: foreign_view_id,
          view_name: 'User1 Copy',
          view_description: 'forked from user2 share',
          table_state: valid_table_state
        })

      res.should.have.status(200)
      expect(res.body.view_id).to.not.equal(foreign_view_id)
      expect(res.body.user_id).to.equal(user1_id)

      const original = await knex('user_data_views')
        .where({ view_id: foreign_view_id })
        .first()
      expect(original.user_id).to.equal(user2_id)
      expect(original.view_name).to.equal('User2 Original')
    })

    it('updates in place when saving the requester own view', async function () {
      const own_view_id = '11111111-2222-3333-4444-555555555555'
      await knex('user_data_views').insert({
        view_id: own_view_id,
        user_id: user1_id,
        view_name: 'Mine Before',
        view_description: 'original',
        table_state: JSON.stringify(valid_table_state)
      })

      const res = await chai_request
        .execute(server)
        .post('/api/data-views')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          view_id: own_view_id,
          view_name: 'Mine After',
          view_description: 'edited',
          table_state: valid_table_state
        })

      res.should.have.status(200)
      expect(res.body.view_id).to.equal(own_view_id)
      expect(res.body.view_name).to.equal('Mine After')

      const rows = await knex('user_data_views').where({ view_id: own_view_id })
      expect(rows).to.have.lengthOf(1)
    })
  })

  describe('POST /api/plays/views', function () {
    it('forks into a new owned plays view when view_id does not exist', async function () {
      const bogus_view_id = 'cccccccc-dddd-eeee-ffff-000000000000'
      const res = await chai_request
        .execute(server)
        .post('/api/plays/views')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          view_id: bogus_view_id,
          view_name: 'Week 6 49ers',
          view_description: 'opened via /u/<hash>',
          table_state: valid_table_state
        })

      res.should.have.status(200)
      expect(res.body.view_id).to.not.equal(bogus_view_id)
      expect(res.body.user_id).to.equal(user1_id)

      const orphan = await knex('user_plays_views')
        .where({ view_id: bogus_view_id })
        .first()
      expect(orphan).to.equal(undefined)
    })
  })
})
