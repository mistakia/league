/* global describe, before, beforeEach, it */
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

describe('API /data-views (view organization)', function () {
  this.timeout(20000)
  let token1
  let user1_id
  let user2_id
  let view_id_1

  before(async function () {
    // Re-seed users
    await knex('users').del()
    await knex.raw('ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1')

    const salt = await bcrypt.genSalt(10)
    const pw1 = await bcrypt.hash('testpass1', salt)
    const pw2 = await bcrypt.hash('testpass2', salt)

    const [u1] = await knex('users')
      .insert({
        email: 'orgtest1@test.com',
        username: 'orgtest1',
        password: pw1
      })
      .returning('id')
    const [u2] = await knex('users')
      .insert({
        email: 'orgtest2@test.com',
        username: 'orgtest2',
        password: pw2
      })
      .returning('id')

    user1_id = u1.id || u1
    user2_id = u2.id || u2

    token1 = await get_token('orgtest1@test.com', 'testpass1')
    await get_token('orgtest2@test.com', 'testpass2')

    // Clean up any existing data
    await knex('user_data_view_favorites').del()
    await knex('user_data_view_tags').del()
    await knex('user_data_views').del()

    // Create test views
    const v1 = 'test-view-org-1'
    const v2 = 'test-view-org-2'
    view_id_1 = v1

    await knex('user_data_views').insert({
      view_id: v1,
      user_id: user1_id,
      view_name: 'Org Test View 1',
      view_description: 'Test',
      table_state: JSON.stringify({ columns: [], prefix_columns: [] })
    })
    await knex('user_data_views').insert({
      view_id: v2,
      user_id: user2_id,
      view_name: 'Org Test View 2',
      view_description: 'Test',
      table_state: JSON.stringify({ columns: [], prefix_columns: [] })
    })
  })

  beforeEach(async function () {
    await knex('user_data_view_favorites').del()
    await knex('user_data_view_tags').del()
  })

  // ==========================================
  // GET /organization
  // ==========================================

  describe('GET /api/data-views/organization', function () {
    it('returns 401 when not authenticated', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/data-views/organization')
      res.should.have.status(401)
    })

    it('returns empty favorites and tags for new user', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/data-views/organization')
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)
      res.body.favorites.should.be.an('array').with.lengthOf(0)
      res.body.tags_by_view_id.should.deep.equal({})
    })

    it('filters orphaned favorites (view deleted by another user)', async function () {
      // Insert a favorite for a view_id that belongs to user2, not user1
      // (cross-user orphan: user1 somehow has a favorite for view_id_2 after user2 deletes it)
      const orphan_view_id = 'orphan-view-zzz-999'
      await knex('user_data_view_favorites').insert({
        user_id: user1_id,
        view_id: orphan_view_id
      })

      const res = await chai_request
        .execute(server)
        .get('/api/data-views/organization')
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)
      // The orphan view_id is not in user1's views or system views → filtered out
      expect(res.body.favorites).to.not.include(orphan_view_id)
    })

    it('preserves system-view favorites (system views have no DB row)', async function () {
      await knex('user_data_view_favorites').insert({
        user_id: user1_id,
        view_id: 'SEASON_FANTASY_POINTS'
      })

      const res = await chai_request
        .execute(server)
        .get('/api/data-views/organization')
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)
      expect(res.body.favorites).to.include('SEASON_FANTASY_POINTS')
    })

    it('filters orphaned tags but preserves system-view tags', async function () {
      const orphan_view_id = 'orphan-view-tags-zzz'
      await knex('user_data_view_tags').insert([
        {
          user_id: user1_id,
          view_id: orphan_view_id,
          tag_name: 'should-be-gone',
          source: 'user'
        },
        {
          user_id: user1_id,
          view_id: 'SEASON_PROJECTIONS',
          tag_name: 'system-tag',
          source: 'user'
        }
      ])

      const res = await chai_request
        .execute(server)
        .get('/api/data-views/organization')
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)
      expect(res.body.tags_by_view_id[orphan_view_id]).to.be.undefined
      expect(res.body.tags_by_view_id.SEASON_PROJECTIONS).to.deep.equal([
        { name: 'system-tag', source: 'user' }
      ])
    })
  })

  // ==========================================
  // POST /:view_id/favorite
  // ==========================================

  describe('POST /api/data-views/:view_id/favorite', function () {
    it('returns 401 when not authenticated', async function () {
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/favorite`)
      res.should.have.status(401)
    })

    it('favorites a view successfully', async function () {
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/favorite`)
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)
      res.body.success.should.equal(true)

      const row = await knex('user_data_view_favorites')
        .where({ user_id: user1_id, view_id: view_id_1 })
        .first()
      expect(row).to.not.be.undefined
    })

    it('is idempotent — second POST returns 200 without error', async function () {
      await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/favorite`)
        .set('Authorization', `Bearer ${token1}`)

      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/favorite`)
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)
      res.body.success.should.equal(true)

      const count = await knex('user_data_view_favorites')
        .where({ user_id: user1_id, view_id: view_id_1 })
        .count('* as n')
      expect(Number(count[0].n)).to.equal(1)
    })
  })

  // ==========================================
  // DELETE /:view_id/favorite
  // ==========================================

  describe('DELETE /api/data-views/:view_id/favorite', function () {
    it('removes a favorite', async function () {
      await knex('user_data_view_favorites').insert({
        user_id: user1_id,
        view_id: view_id_1
      })

      const res = await chai_request
        .execute(server)
        .delete(`/api/data-views/${view_id_1}/favorite`)
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)

      const row = await knex('user_data_view_favorites')
        .where({ user_id: user1_id, view_id: view_id_1 })
        .first()
      expect(row).to.be.undefined
    })

    it('is idempotent — DELETE when not favorited returns 200', async function () {
      const res = await chai_request
        .execute(server)
        .delete(`/api/data-views/${view_id_1}/favorite`)
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)
    })
  })

  // ==========================================
  // POST /:view_id/tags
  // ==========================================

  describe('POST /api/data-views/:view_id/tags', function () {
    it('returns 401 when not authenticated', async function () {
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .send({ tag_name: 'my-tag' })
      res.should.have.status(401)
    })

    it('adds a user tag', async function () {
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: 'weekly-qb' })
      res.should.have.status(200)
      res.body.tag_name.should.equal('weekly-qb')

      const row = await knex('user_data_view_tags')
        .where({ user_id: user1_id, view_id: view_id_1, tag_name: 'weekly-qb' })
        .first()
      expect(row).to.not.be.undefined
      expect(row.source).to.equal('user')
    })

    it('lowercases the tag_name', async function () {
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: 'MyTag' })
      res.should.have.status(200)
      res.body.tag_name.should.equal('mytag')
    })

    it('trims whitespace from tag_name', async function () {
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: '  trimmed  ' })
      res.should.have.status(200)
      res.body.tag_name.should.equal('trimmed')
    })

    it('is idempotent — duplicate insert returns 200 no-op', async function () {
      await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: 'dup-tag' })

      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: 'dup-tag' })
      res.should.have.status(200)

      const count = await knex('user_data_view_tags')
        .where({ user_id: user1_id, view_id: view_id_1, tag_name: 'dup-tag' })
        .count('* as n')
      expect(Number(count[0].n)).to.equal(1)
    })

    it('rejects empty tag_name', async function () {
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: '   ' })
      res.should.have.status(400)
    })

    it('rejects tag_name with control characters', async function () {
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: 'bad\x01tag' })
      res.should.have.status(400)
    })

    it('rejects tag_name with non-ASCII characters', async function () {
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: 'café' })
      res.should.have.status(400)
    })

    it('rejects tag_name exceeding 64 characters', async function () {
      const long_tag = 'a'.repeat(65)
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: long_tag })
      res.should.have.status(400)
    })

    it('accepts tag_name of exactly 64 characters', async function () {
      const exact_tag = 'a'.repeat(64)
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: exact_tag })
      res.should.have.status(200)
    })

    it('promotes source=llm row to source=user on conflict', async function () {
      // Seed an LLM tag directly
      await knex('user_data_view_tags').insert({
        user_id: user1_id,
        view_id: view_id_1,
        tag_name: 'llm-promoted',
        source: 'llm'
      })

      // User tags the same name → should promote to 'user'
      const res = await chai_request
        .execute(server)
        .post(`/api/data-views/${view_id_1}/tags`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ tag_name: 'llm-promoted' })
      res.should.have.status(200)

      const row = await knex('user_data_view_tags')
        .where({
          user_id: user1_id,
          view_id: view_id_1,
          tag_name: 'llm-promoted'
        })
        .first()
      expect(row.source).to.equal('user')

      const count = await knex('user_data_view_tags')
        .where({
          user_id: user1_id,
          view_id: view_id_1,
          tag_name: 'llm-promoted'
        })
        .count('* as n')
      expect(Number(count[0].n)).to.equal(1)
    })
  })

  // ==========================================
  // DELETE /:view_id/tags/:tag_name
  // ==========================================

  describe('DELETE /api/data-views/:view_id/tags/:tag_name', function () {
    it('removes a user tag', async function () {
      await knex('user_data_view_tags').insert({
        user_id: user1_id,
        view_id: view_id_1,
        tag_name: 'removeme',
        source: 'user'
      })

      const res = await chai_request
        .execute(server)
        .delete(`/api/data-views/${view_id_1}/tags/removeme`)
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)

      const row = await knex('user_data_view_tags')
        .where({ user_id: user1_id, view_id: view_id_1, tag_name: 'removeme' })
        .first()
      expect(row).to.be.undefined
    })

    it('does NOT remove source=llm rows', async function () {
      await knex('user_data_view_tags').insert({
        user_id: user1_id,
        view_id: view_id_1,
        tag_name: 'llm-only',
        source: 'llm'
      })

      const res = await chai_request
        .execute(server)
        .delete(`/api/data-views/${view_id_1}/tags/llm-only`)
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)

      // LLM row should still exist
      const row = await knex('user_data_view_tags')
        .where({ user_id: user1_id, view_id: view_id_1, tag_name: 'llm-only' })
        .first()
      expect(row).to.not.be.undefined
      expect(row.source).to.equal('llm')
    })

    it('is idempotent — DELETE when tag not present returns 200', async function () {
      const res = await chai_request
        .execute(server)
        .delete(`/api/data-views/${view_id_1}/tags/nonexistent`)
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)
    })
  })

  // ==========================================
  // DELETE /:view_id cascade atomicity
  // ==========================================

  describe('DELETE /api/data-views/:view_id (cascade + atomicity)', function () {
    it('deletes favorites and tags when view is deleted', async function () {
      // Create a view owned by user1
      const temp_view_id = 'temp-cascade-test-view'
      await knex('user_data_views').insert({
        view_id: temp_view_id,
        user_id: user1_id,
        view_name: 'Cascade Test',
        view_description: '',
        table_state: JSON.stringify({ columns: [], prefix_columns: [] })
      })
      await knex('user_data_view_favorites').insert({
        user_id: user1_id,
        view_id: temp_view_id
      })
      await knex('user_data_view_tags').insert({
        user_id: user1_id,
        view_id: temp_view_id,
        tag_name: 'cascade-tag',
        source: 'user'
      })

      const res = await chai_request
        .execute(server)
        .delete(`/api/data-views/${temp_view_id}`)
        .set('Authorization', `Bearer ${token1}`)
      res.should.have.status(200)

      // Check cascade: favorites and tags should be gone
      const fav = await knex('user_data_view_favorites')
        .where({ view_id: temp_view_id })
        .first()
      expect(fav).to.be.undefined

      const tag = await knex('user_data_view_tags')
        .where({ view_id: temp_view_id })
        .first()
      expect(tag).to.be.undefined

      const view = await knex('user_data_views')
        .where({ view_id: temp_view_id })
        .first()
      expect(view).to.be.undefined
    })
  })
})
