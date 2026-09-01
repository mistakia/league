/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import users from '#db/fixtures/users.mjs'
import { user1, user2 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()

const create_key = async ({ token, name }) => {
  const res = await chai_request
    .execute(server)
    .post('/api/settings/api-keys')
    .set('Authorization', `Bearer ${token}`)
    .send({ name })
  res.should.have.status(200)
  return res.body
}

describe('API /settings/api-keys', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
    await users(knex)
  })

  beforeEach(async function () {
    await knex('user_api_keys').del()
  })

  describe('PUT /api/settings/api-keys/:api_key_id', function () {
    it('renames a key and leaves its secret material alone', async () => {
      const created = await create_key({ token: user1, name: 'laptop' })
      const { key_hash: hash_before } = await knex('user_api_keys')
        .where({ api_key_id: created.api_key_id })
        .first()

      const res = await chai_request
        .execute(server)
        .put(`/api/settings/api-keys/${created.api_key_id}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({ name: 'nightly export' })

      res.should.have.status(200)
      res.body.name.should.equal('nightly export')
      res.body.key_prefix.should.equal(created.key_prefix)
      // The plaintext is returned once, at creation, and never again.
      res.body.should.not.have.property('key')
      res.body.should.not.have.property('key_hash')

      const row = await knex('user_api_keys')
        .where({ api_key_id: created.api_key_id })
        .first()
      row.name.should.equal('nightly export')
      row.key_hash.should.equal(hash_before)
    })

    // The ownership check is the user_id predicate in the WHERE clause, not the
    // auth guard, which only proves who the caller is. A control against the
    // owner renaming the same key is what makes this test non-vacuous: without
    // it, a route broken in any other way would also return 404 here.
    it("refuses to rename another user's key", async () => {
      const created = await create_key({ token: user1, name: 'mine' })

      const res = await chai_request
        .execute(server)
        .put(`/api/settings/api-keys/${created.api_key_id}`)
        .set('Authorization', `Bearer ${user2}`)
        .send({ name: 'stolen' })

      res.should.have.status(404)

      const row = await knex('user_api_keys')
        .where({ api_key_id: created.api_key_id })
        .first()
      row.name.should.equal('mine')

      const owner_res = await chai_request
        .execute(server)
        .put(`/api/settings/api-keys/${created.api_key_id}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({ name: 'still mine' })
      owner_res.should.have.status(200)
    })

    it('refuses to rename a revoked key', async () => {
      const created = await create_key({ token: user1, name: 'retired' })

      const revoke_res = await chai_request
        .execute(server)
        .delete(`/api/settings/api-keys/${created.api_key_id}`)
        .set('Authorization', `Bearer ${user1}`)
      revoke_res.should.have.status(200)

      const res = await chai_request
        .execute(server)
        .put(`/api/settings/api-keys/${created.api_key_id}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({ name: 'renamed after the fact' })

      res.should.have.status(404)

      const row = await knex('user_api_keys')
        .where({ api_key_id: created.api_key_id })
        .first()
      row.name.should.equal('retired')
    })

    it('rejects a name over the length ceiling and a missing name', async () => {
      const created = await create_key({ token: user1, name: 'ok' })

      const too_long = await chai_request
        .execute(server)
        .put(`/api/settings/api-keys/${created.api_key_id}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({ name: 'a'.repeat(61) })
      too_long.should.have.status(400)

      const absent = await chai_request
        .execute(server)
        .put(`/api/settings/api-keys/${created.api_key_id}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({})
      absent.should.have.status(400)

      // Control: one character under the ceiling is accepted, so the 400 above
      // is the length rule and not the route refusing every rename.
      const at_ceiling = await chai_request
        .execute(server)
        .put(`/api/settings/api-keys/${created.api_key_id}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({ name: 'a'.repeat(60) })
      at_ceiling.should.have.status(200)
    })

    it('rejects a non-numeric api_key_id', async () => {
      const res = await chai_request
        .execute(server)
        .put('/api/settings/api-keys/not-a-number')
        .set('Authorization', `Bearer ${user1}`)
        .send({ name: 'whatever' })

      res.should.have.status(400)
    })
  })
})
