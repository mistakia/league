/* global describe, before, after, it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import server from '#api'
import knex from '#db'
import config from '#config'
import users from '#db/fixtures/users.mjs'
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
      const res = await chai_request
        .execute(server)
        .post('/api/auth/login')
        .send({
          email_or_username: 'user1@email.com',
          password: 'password1'
        })

      res.should.have.status(200)
      res.body.should.have.property('token')
      res.body.should.have.property('userId')
    })

    it('should login successfully with username', async () => {
      const res = await chai_request
        .execute(server)
        .post('/api/auth/login')
        .send({
          email_or_username: 'user1',
          password: 'password1'
        })

      res.should.have.status(200)
      res.body.should.have.property('token')
      res.body.should.have.property('userId')
    })

    it('should return error for missing email or username', async () => {
      const res = chai_request
        .execute(server)
        .post('/api/auth/login')
        .send({ password: 'password1' })

      await error(res, 'missing email or username param')
    })

    it('should return error for missing password', async () => {
      const res = chai_request
        .execute(server)
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

      const res = await chai_request
        .execute(server)
        .post('/api/auth/register')
        .send({
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

      new_user.should.exist
      new_user.username.should.equal('newuser')
      new_user.invite_code.should.equal(invite_code)

      // Validate invite code table
      const updated_invite = await knex('invite_codes')
        .where({ code: invite_code })
        .first()

      updated_invite.should.exist
      updated_invite.uses_count.should.equal(1)
      updated_invite.used_by.should.equal(new_user.id)

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

      const res = await chai_request
        .execute(server)
        .post('/api/auth/register')
        .send({
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

      const res = await chai_request
        .execute(server)
        .post('/api/auth/register')
        .send({
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

  describe('POST /api/auth/reset-password', () => {
    const generic_message =
      'If an account exists, a password reset email has been sent'

    it('should return the generic message for a known email', async () => {
      const res = await chai_request
        .execute(server)
        .post('/api/auth/reset-password')
        .send({ email: 'user1@email.com' })

      res.should.have.status(200)
      res.body.message.should.equal(generic_message)
    })

    it('should return the generic message for a known username', async () => {
      const res = await chai_request
        .execute(server)
        .post('/api/auth/reset-password')
        .send({ username: 'user1' })

      res.should.have.status(200)
      res.body.message.should.equal(generic_message)
    })

    // The route must not be a user-enumeration oracle: an unknown account has
    // to be indistinguishable from a known one. It answered 400 `user not
    // found` here until the reset flow was completed.
    it('should return the generic message for an unknown username', async () => {
      const res = await chai_request
        .execute(server)
        .post('/api/auth/reset-password')
        .send({ username: 'no-such-user-anywhere' })

      res.should.have.status(200)
      res.body.message.should.equal(generic_message)
    })

    it('should return the generic message for an unknown email', async () => {
      const res = await chai_request
        .execute(server)
        .post('/api/auth/reset-password')
        .send({ email: 'no-such-user-anywhere@email.com' })

      res.should.have.status(200)
      res.body.message.should.equal(generic_message)
    })

    it('should return error for missing username and email', async () => {
      const res = chai_request
        .execute(server)
        .post('/api/auth/reset-password')
        .send({})

      await error(res, 'missing username or email')
    })
  })

  describe('POST /api/auth/reset-password/confirm', () => {
    const reset_username = 'reset_password_user'
    const reset_email = 'reset_password_user@email.com'
    const original_password = 'original_password'

    let reset_user_id = null

    // Mint a token exactly as POST /auth/reset-password does. This spec cannot
    // read the emailed token — nothing is sent in test, since `config.email`
    // is unset — so the two derivations are asserted to agree by construction
    // rather than by round trip. That is the one gap here; everything below it
    // (expiry, tampering, replay, the write itself) is exercised end to end.
    const sign_reset_token = ({ user, expires_in = '1h' }) =>
      jwt.sign({ user_id: user.id }, `${config.jwt.secret}${user.password}`, {
        expiresIn: expires_in
      })

    const get_reset_user = () =>
      knex('users').where({ id: reset_user_id }).first()

    before(async () => {
      const salt = await bcrypt.genSalt(10)
      const hashed_password = await bcrypt.hash(original_password, salt)
      const inserted = await knex('users')
        .insert({
          email: reset_email,
          username: reset_username,
          password: hashed_password
        })
        .returning('id')
      reset_user_id = inserted[0].id
    })

    after(async () => {
      await knex('users').where({ id: reset_user_id }).del()
    })

    it('should return error for missing token', async () => {
      const res = chai_request
        .execute(server)
        .post('/api/auth/reset-password/confirm')
        .send({ password: 'new_password' })

      await error(res, 'missing token param')
    })

    it('should return error for missing password', async () => {
      const user = await get_reset_user()
      const res = chai_request
        .execute(server)
        .post('/api/auth/reset-password/confirm')
        .send({ token: sign_reset_token({ user }) })

      await error(res, 'missing password param')
    })

    it('should return error for a malformed token', async () => {
      const res = chai_request
        .execute(server)
        .post('/api/auth/reset-password/confirm')
        .send({ token: 'not-a-jwt', password: 'new_password' })

      await error(res, 'invalid or expired reset token')
    })

    it('should return error for a token signed with the bare jwt secret', async () => {
      const user = await get_reset_user()
      const token = jwt.sign({ user_id: user.id }, config.jwt.secret, {
        expiresIn: '1h'
      })

      const res = chai_request
        .execute(server)
        .post('/api/auth/reset-password/confirm')
        .send({ token, password: 'new_password' })

      await error(res, 'invalid or expired reset token')
    })

    it('should return error for an expired token', async () => {
      const user = await get_reset_user()
      const token = sign_reset_token({ user, expires_in: '-1s' })

      const res = chai_request
        .execute(server)
        .post('/api/auth/reset-password/confirm')
        .send({ token, password: 'new_password' })

      await error(res, 'invalid or expired reset token')
    })

    it('should return error for a token naming an unknown user', async () => {
      const token = jwt.sign({ user_id: 999999 }, config.jwt.secret, {
        expiresIn: '1h'
      })

      const res = chai_request
        .execute(server)
        .post('/api/auth/reset-password/confirm')
        .send({ token, password: 'new_password' })

      await error(res, 'invalid or expired reset token')
    })

    it('should set the new password and reject the old one', async () => {
      const user = await get_reset_user()
      const token = sign_reset_token({ user })
      const new_password = 'a_brand_new_password'

      const res = await chai_request
        .execute(server)
        .post('/api/auth/reset-password/confirm')
        .send({ token, password: new_password })

      res.should.have.status(200)
      res.body.message.should.equal('password has been reset')

      const login_with_new = await chai_request
        .execute(server)
        .post('/api/auth/login')
        .send({ email_or_username: reset_username, password: new_password })

      login_with_new.should.have.status(200)
      login_with_new.body.should.have.property('token')

      const login_with_old = chai_request
        .execute(server)
        .post('/api/auth/login')
        .send({
          email_or_username: reset_username,
          password: original_password
        })

      await error(login_with_old, 'invalid params')

      // The token's signing secret carries the user's password hash, so the
      // reset above invalidated it — a replayed link cannot set the password
      // a second time. This is what makes the token single-use without any
      // server-side state.
      const replay = chai_request
        .execute(server)
        .post('/api/auth/reset-password/confirm')
        .send({ token, password: 'yet_another_password' })

      await error(replay, 'invalid or expired reset token')
    })
  })
})
