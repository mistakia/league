/* global describe, before it */
import chai from 'chai'
import chaiHTTP from 'chai-http'

import server from '#api'
import knex from '#db'
import users from '#db/seeds/users.mjs'
import { user1 } from './fixtures/token.mjs'
import { error } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.use(chaiHTTP)
chai.should()

describe('API /me', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    await users(knex)
  })

  describe('GET /api/me', async () => {
    it('should return user information', async () => {
      const res = await chai
        .request(server)
        .get('/api/me')
        .set('Authorization', `Bearer ${user1}`)
      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json
      res.body.user.id.should.equal(1)
      res.body.user.email.should.equal('user1@email.com')
      res.body.teams.should.be.an('array')
      res.body.leagues.should.be.an('array')
      res.body.sources.should.be.an('array')
      res.body.poaches.should.be.an('array')
      res.body.waivers.should.be.an('array')
    })
  })

  describe('PUT /api/me', function () {
    it('should change username successfully', async () => {
      const new_username = 'new_user1'
      const res = await chai
        .request(server)
        .put('/api/me')
        .set('Authorization', `Bearer ${user1}`)
        .send({ type: 'username', value: new_username })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json
      res.body.value.should.equal(new_username)

      const updated_user = await knex('users').where({ id: 1 }).first()
      updated_user.username.should.equal(new_username)
    })

    it('should validate username', async () => {
      const invalid_usernames = [
        'ab', // too short
        'a'.repeat(21), // too long
        'invalid username', // contains space
        'invalid@username' // contains special character
      ]

      const invalid_username_messages = [
        "The 'username' field length must be greater than or equal to 3 characters long.",
        "The 'username' field length must be less than or equal to 20 characters long.",
        "The 'username' field must contain only alphanumeric characters and underscores",
        "The 'username' field must contain only alphanumeric characters and underscores"
      ]

      for (const [index, invalid_username] of invalid_usernames.entries()) {
        const res = chai
          .request(server)
          .put('/api/me')
          .set('Authorization', `Bearer ${user1}`)
          .send({ type: 'username', value: invalid_username })

        await error(res, invalid_username_messages[index])
      }
    })

    it('should not allow already taken username', async () => {
      // First, create a user with a specific username
      const existing_username = 'existing_user'
      await knex('users').insert({
        username: existing_username,
        email: 'existing@email.com',
        password: 'password123'
      })

      // Try to change user1's username to the existing username
      const res = chai
        .request(server)
        .put('/api/me')
        .set('Authorization', `Bearer ${user1}`)
        .send({ type: 'username', value: existing_username })

      await error(res, 'username already taken')
    })
  })
})
