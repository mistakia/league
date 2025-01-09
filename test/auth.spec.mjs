/* global describe, before, it */
import * as chai from 'chai'
import { default as chai_http, request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import users from '#db/seeds/users.mjs'
import { error } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()

describe('API /auth', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
    await users(knex)
  })

  describe('POST /api/auth/login', () => {
    it('should login successfully with email', async () => {
      const res = await chai_request.execute(server).post('/api/auth/login').send({
        email_or_username: 'user1@email.com',
        password: 'password1'
      })

      res.should.have.status(200)
      res.body.should.have.property('token')
      res.body.should.have.property('userId')
    })

    it('should login successfully with username', async () => {
      const res = await chai_request.execute(server).post('/api/auth/login').send({
        email_or_username: 'user1',
        password: 'password1'
      })

      res.should.have.status(200)
      res.body.should.have.property('token')
      res.body.should.have.property('userId')
    })

    it('should return error for missing email or username', async () => {
      const res = chai_request.execute(server)
        .post('/api/auth/login')
        .send({ password: 'password1' })

      await error(res, 'missing email or username param')
    })

    it('should return error for missing password', async () => {
      const res = chai_request.execute(server)
        .post('/api/auth/login')
        .send({ email_or_username: 'user1@email.com' })

      await error(res, 'missing password param')
    })

    it('should return error for invalid credentials', async () => {
      const res = chai_request.execute(server).post('/api/auth/login').send({
        email_or_username: 'user1@email.com',
        password: 'wrongpassword'
      })

      await error(res, 'invalid params')
    })
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Create a valid invite code
      const invite_code = 'validinvitecode'
      await knex('invite_codes').insert({
        code: invite_code,
        is_active: true,
        created_at: knex.fn.now(),
        created_by: 1, // Assuming user with ID 1 exists
        uses_count: 0
      })

      const res = await chai_request.execute(server).post('/api/auth/register').send({
        email: 'newuser@email.com',
        password: 'newpassword123',
        username: 'newuser',
        invite_code
      })

      res.should.have.status(200)
      res.body.should.have.property('token')
      res.body.should.have.property('userId')

      // Validate user table
      const new_user = await knex('users')
        .where({ email: 'newuser@email.com' })
        .first()
      // eslint-disable-next-line
      new_user.should.exist
      new_user.username.should.equal('newuser')
      new_user.invite_code.should.equal(invite_code)

      // Validate invite code table
      const updated_invite = await knex('invite_codes')
        .where({ code: invite_code })
        .first()
      // eslint-disable-next-line
      updated_invite.should.exist
      updated_invite.uses_count.should.equal(1)
      updated_invite.used_by.should.equal(new_user.id)
      // eslint-disable-next-line
      updated_invite.used_at.should.not.be.null

      // Clean up: remove the created user and invite code
      await knex('users').where({ id: new_user.id }).del()
      await knex('invite_codes').where({ code: invite_code }).del()
    })

    it('should return error for missing password', async () => {
      const res = chai_request.execute(server).post('/api/auth/register').send({
        email: 'newuser2@email.com',
        username: 'newuser2',
        invite_code: 'validinvitecode'
      })

      await error(res, 'missing password param')
    })

    it('should return error for invalid email', async () => {
      const res = chai_request.execute(server).post('/api/auth/register').send({
        email: 'invalidemail',
        password: 'password123',
        username: 'newuser3',
        invite_code: 'validinvitecode'
      })

      await error(res, 'Invalid email address')
    })

    it('should return error for existing email', async () => {
      const res = chai_request.execute(server).post('/api/auth/register').send({
        email: 'user1@email.com',
        password: 'password123',
        username: 'newuser4',
        invite_code: 'validinvitecode'
      })

      await error(res, 'email exists')
    })

    it('should return error for invalid username', async () => {
      const res = chai_request.execute(server).post('/api/auth/register').send({
        email: 'newuser5@email.com',
        password: 'password123',
        username: 'in valid',
        invite_code: 'validinvitecode'
      })

      await error(
        res,
        "The 'username' field must contain only alphanumeric characters and underscores"
      )
    })

    it('should return error for existing username', async () => {
      const res = chai_request.execute(server).post('/api/auth/register').send({
        email: 'newuser6@email.com',
        password: 'password123',
        username: 'user1',
        invite_code: 'validinvitecode'
      })

      await error(res, 'username exists')
    })

    it('should return error for missing invite code', async () => {
      const res = chai_request.execute(server).post('/api/auth/register').send({
        email: 'newuser7@email.com',
        password: 'password123',
        username: 'newuser7'
      })

      await error(res, 'missing invite code')
    })

    it('should return error for invalid invite code', async () => {
      const res = chai_request.execute(server).post('/api/auth/register').send({
        email: 'newuser8@email.com',
        password: 'password123',
        username: 'newuser8',
        invite_code: 'invalidcode'
      })

      await error(res, 'invalid invite code')
    })

    it('should return error for expired invite code', async () => {
      // Create an expired invite code
      const expired_invite_code = 'expiredinvitecode'
      const past_date = new Date()
      past_date.setDate(past_date.getDate() - 1) // Set to yesterday

      await knex('invite_codes').insert({
        code: expired_invite_code,
        is_active: true,
        created_at: knex.fn.now(),
        created_by: 1,
        uses_count: 0,
        expires_at: past_date
      })

      const res = await chai_request.execute(server).post('/api/auth/register').send({
        email: 'expireduser@email.com',
        password: 'password123',
        username: 'expireduser',
        invite_code: expired_invite_code
      })

      await error(res, 'invite code has expired')

      // Clean up
      await knex('invite_codes').where({ code: expired_invite_code }).del()
    })

    it('should return error for invite code exceeding max uses', async () => {
      // Create an invite code that has reached its max uses
      const max_uses_invite_code = 'maxusesinvitecode'
      await knex('invite_codes').insert({
        code: max_uses_invite_code,
        is_active: true,
        created_at: knex.fn.now(),
        created_by: 1,
        uses_count: 5,
        max_uses: 5
      })

      const res = await chai_request.execute(server).post('/api/auth/register').send({
        email: 'maxusesuser@email.com',
        password: 'password123',
        username: 'maxusesuser',
        invite_code: max_uses_invite_code
      })

      await error(res, 'invite code has reached maximum uses')

      // Clean up
      await knex('invite_codes').where({ code: max_uses_invite_code }).del()
    })
  })
})
