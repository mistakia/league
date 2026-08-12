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

async function get_token(email, password) {
  const res = await chai_request
    .execute(server)
    .post('/api/auth/login')
    .send({ email_or_username: email, password })
  return res.body.token
}

// GET /api/data-views is mounted before the blanket auth guard in
// api/index.mjs, so it must self-enforce. It once had no auth check and no
// mandatory filter, which made every saved view on the platform enumerable by
// an anonymous caller. It is now owner-scoped with no filter parameters, with
// one deliberate server-side exception: the admin account (userId 1, the same
// check /data-views/debug and the cache routes use) may list every saved view
// for audit and triage. Fetch-by-id stays unauthenticated on purpose: that is
// how a shared view resolves for a logged-out visitor.
describe('GET /api/data-views is owner-scoped (admin sees all)', function () {
  this.timeout(20000)
  let token_admin
  let token1
  let token2
  let user1_id
  let user2_id

  before(async function () {
    await knex('user_data_view_favorites').del()
    await knex('user_data_view_tags').del()
    await knex('user_data_views').del()
    await knex('users').del()
    await knex.raw('ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1')

    const salt = await bcrypt.genSalt(10)
    const pw_admin = await bcrypt.hash('adminpass', salt)
    const pw1 = await bcrypt.hash('scopetest1', salt)
    const pw2 = await bcrypt.hash('scopetest2', salt)

    // The admin account is user 1, matching the runtime identity the route
    // treats as admin.
    await knex('users').insert({
      email: 'admin@test.com',
      username: 'admin',
      password: pw_admin
    })

    const [u1] = await knex('users')
      .insert({
        email: 'scopetest1@test.com',
        username: 'scopetest1',
        password: pw1
      })
      .returning('id')
    const [u2] = await knex('users')
      .insert({
        email: 'scopetest2@test.com',
        username: 'scopetest2',
        password: pw2
      })
      .returning('id')

    user1_id = u1.id || u1
    user2_id = u2.id || u2

    await knex('user_data_views').insert([
      {
        view_id: '9d7f6b1c-2a4e-4c8f-9b3d-5e1a7c0f2b46',
        view_name: 'Owned By One',
        view_description: 'visible to its owner',
        table_state: JSON.stringify({ columns: ['player_name'] }),
        user_id: user1_id
      },
      {
        view_id: '3c2b8a4d-7e59-4f10-8a6c-1d9b4e7f0a35',
        view_name: 'Owned By Two',
        view_description: 'private research the owner did not publish',
        table_state: JSON.stringify({ columns: ['player_name'] }),
        user_id: user2_id
      }
    ])

    token_admin = await get_token('admin@test.com', 'adminpass')
    token1 = await get_token('scopetest1@test.com', 'scopetest1')
    token2 = await get_token('scopetest2@test.com', 'scopetest2')
  })

  it('rejects an unauthenticated caller', async function () {
    const res = await chai_request.execute(server).get('/api/data-views')
    res.should.have.status(401)
  })

  it('returns every saved view for the admin account', async function () {
    const res = await chai_request
      .execute(server)
      .get('/api/data-views')
      .set('Authorization', `Bearer ${token_admin}`)

    res.should.have.status(200)
    res.body.should.be.an('array')
    res.body.length.should.equal(2)
    const names = res.body.map((v) => v.view_name).sort()
    names.should.deep.equal(['Owned By One', 'Owned By Two'])
  })

  it('returns only the authenticated user views', async function () {
    const res = await chai_request
      .execute(server)
      .get('/api/data-views')
      .set('Authorization', `Bearer ${token1}`)

    res.should.have.status(200)
    res.body.should.be.an('array')
    res.body.length.should.equal(1)
    res.body[0].view_name.should.equal('Owned By One')
    res.body[0].user_id.should.equal(user1_id)
  })

  it('ignores a user_id parameter naming another user', async function () {
    const res = await chai_request
      .execute(server)
      .get(`/api/data-views?user_id=${user2_id}`)
      .set('Authorization', `Bearer ${token1}`)

    res.should.have.status(200)
    res.body.length.should.equal(1)
    res.body[0].user_id.should.equal(user1_id)
  })

  it('ignores a username parameter naming another user', async function () {
    const res = await chai_request
      .execute(server)
      .get('/api/data-views?username=scopetest2')
      .set('Authorization', `Bearer ${token1}`)

    res.should.have.status(200)
    res.body.length.should.equal(1)
    res.body[0].user_id.should.equal(user1_id)
  })

  it('still owner-scopes the list for a second non-admin user', async function () {
    const res = await chai_request
      .execute(server)
      .get('/api/data-views')
      .set('Authorization', `Bearer ${token2}`)

    res.should.have.status(200)
    res.body.length.should.equal(1)
    res.body[0].view_name.should.equal('Owned By Two')
    res.body[0].user_id.should.equal(user2_id)
  })

  // Deliberate: an unguessable view_id is the sharing mechanism, and locking
  // this down would break every shared link.
  it('still resolves another user view by id without authentication', async function () {
    const res = await chai_request
      .execute(server)
      .get('/api/data-views/3c2b8a4d-7e59-4f10-8a6c-1d9b4e7f0a35')

    res.should.have.status(200)
    res.body.view_name.should.equal('Owned By Two')
    expect(res.body.user_id).to.equal(user2_id)
  })
})
