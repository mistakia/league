import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import { getLeague, sendEmail, validators } from '#libs-server'
import { current_season } from '#constants'
import { create_logger } from '#libs-shared/log.mjs'

const router = express.Router()

// `req.app.locals.logger` is a bare debug namespace, which reaches nobody. This
// is the structured one, used where a failure needs to leave the process and
// find an operator -- see the refused-send path in POST /reset-password.
const auth_error_logger = create_logger('api:auth', {
  service: 'league-server'
})

// A password reset token is signed with the jwt secret CONCATENATED WITH the
// user's current bcrypt hash, which makes it self-invalidating without any
// server-side state: resetting the password (or changing it through PUT /me)
// replaces the hash, so every token minted against the old one stops
// verifying. See the header on POST /reset-password/confirm for why it is
// built this way rather than with a `used` column.
const get_reset_token_secret = ({ config, user }) =>
  `${config.jwt.secret}${user.password}`

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User login
 *     description: Authenticate user with email/username and password to receive JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_or_username:
 *                 type: string
 *                 description: User email or username
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *                 example: mypassword123
 *             required:
 *               - email_or_username
 *               - password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/login', async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    const { email_or_username, password } = req.body
    if (!email_or_username) {
      return res.status(400).send({ error: 'missing email or username param' })
    }

    if (!password) {
      return res.status(400).send({ error: 'missing password param' })
    }

    const users = await db('users')
      .where({ email: email_or_username })
      .orWhere({ username: email_or_username })
    if (!users.length) {
      return res.status(400).send({ error: 'invalid params' })
    }

    const user = users[0]
    const is_valid = await bcrypt.compare(password, user.password)
    if (!is_valid) {
      return res.status(400).send({ error: 'invalid params' })
    }

    const token = jwt.sign({ userId: user.id }, config.jwt.secret)
    res.json({ token, userId: user.id })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User registration
 *     description: Register a new user account with invite code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: user@example.com
 *               username:
 *                 type: string
 *                 description: Desired username (optional, will be generated if not provided)
 *                 example: myusername
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *                 example: mypassword123
 *               invite_code:
 *                 type: string
 *                 description: Valid invite code required for registration
 *                 example: INVITE123
 *               teamId:
 *                 type: integer
 *                 description: Team ID to join (optional)
 *                 example: 1
 *               leagueId:
 *                 type: integer
 *                 description: League ID to join (optional)
 *                 example: 1
 *             required:
 *               - password
 *               - invite_code
 *     responses:
 *       200:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/register', async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    const { email, password, invite_code } = req.body
    let username = req.body.username

    const team_id = req.body.teamId ? Number(req.body.teamId) : null
    const league_id = req.body.leagueId ? Number(req.body.leagueId) : null

    if (!password) {
      return res.status(400).send({ error: 'missing password param' })
    }

    if (email) {
      const result = validators.email_validator({ email })
      if (result !== true) {
        return res.status(400).send({ error: result[0].message })
      }

      const email_exists = await db('users').where({ email })
      if (email_exists.length) {
        return res.status(400).send({ error: 'email exists' })
      }
    }

    if (!username) {
      // generate new unique username
      while (!username) {
        const new_username = 'user' + Math.floor(Math.random() * 10000000000)
        const username_exists = await db('users').where({
          username: new_username
        })
        if (!username_exists.length) {
          username = new_username
        }
      }
    }

    const result = validators.username_validator({ username })
    if (result !== true) {
      return res.status(400).send({ error: result[0].message })
    }

    const username_exists = await db('users').where({ username })
    if (username_exists.length) {
      return res.status(400).send({ error: 'username exists' })
    }

    // Validate invite code
    if (!invite_code) {
      return res.status(400).send({ error: 'missing invite code' })
    }

    const invite = await db('invite_codes')
      .where({ code: invite_code, is_active: true })
      .first()

    if (!invite) {
      return res.status(400).send({ error: 'invalid invite code' })
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).send({ error: 'invite code has expired' })
    }

    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      return res
        .status(400)
        .send({ error: 'invite code has reached maximum uses' })
    }

    if (league_id) {
      const league = getLeague({ lid: league_id })
      if (!league) {
        return res.status(400).send({ error: 'league does not exist' })
      }

      const teams = await db('teams').where({
        lid: league_id,
        season_year: current_season.year
      })
      if (team_id) {
        if (!teams.find((t) => t.uid === team_id)) {
          return res.status(400).send({ error: 'team does not exist' })
        }
      } else if (teams.length === league.number_teams) {
        return res.status(400).send({ error: 'league full' })
      }
    }

    const salt = await bcrypt.genSalt(10)
    const hashed_password = await bcrypt.hash(password, salt)
    const users = await db('users')
      .insert({
        email,
        password: hashed_password,
        username,
        invite_code
      })
      .returning('id')
    const user_id = users[0].id

    // Update invite code usage
    await db('invite_codes')
      .where({ code: invite_code })
      .update({
        used_by: user_id,
        used_at: db.fn.now(),
        uses_count: db.raw('uses_count + 1')
      })

    if (league_id && team_id) {
      await db('users_teams').insert({
        userid: user_id,
        tid: team_id,
        season_year: current_season.year
      })
    }

    const token = jwt.sign({ userId: user_id }, config.jwt.secret)
    res.json({ token, userId: user_id })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request password reset
 *     description: Request a password reset email for a user account. If the user exists, an email will be sent with a reset link that expires in 1 hour.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username of the account to reset (optional if email provided)
 *                 example: myusername
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the account to reset (optional if username provided)
 *                 example: user@example.com
 *             anyOf:
 *               - required: [username]
 *               - required: [email]
 *           examples:
 *             withEmail:
 *               summary: Reset with email
 *               value:
 *                 email: user@example.com
 *             withUsername:
 *               summary: Reset with username
 *               value:
 *                 username: myusername
 *             withBoth:
 *               summary: Reset with both (email takes precedence)
 *               value:
 *                 email: user@example.com
 *                 username: myusername
 *     responses:
 *       200:
 *         description: Password reset email sent (or would have been sent if account exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: If an account exists, a password reset email has been sent
 *               required:
 *                 - message
 *       400:
 *         description: Bad request - missing required parameters. An unknown account is NOT distinguishable here; it returns the same 200 as a known one.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingParams:
 *                 summary: Missing username or email
 *                 value:
 *                   error: missing username or email
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/reset-password', async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    const { username, email } = req.body

    if (!username && !email) {
      return res.status(400).send({ error: 'missing username or email' })
    }

    const user = await db('users')
      .where(function () {
        if (email) this.where({ email })
        if (username) this.orWhere({ username })
      })
      .first()

    // Answer identically whether or not the account exists. Returning
    // `user not found` for an unknown username made this route a
    // user-enumeration oracle that contradicted its own documented contract.
    if (!user) {
      return res.status(200).send({
        message: 'If an account exists, a password reset email has been sent'
      })
    }

    // The token is a signed JWT carrying its own expiry, and nothing is
    // persisted — the reset link is the only thing that presents it, and
    // POST /reset-password/confirm re-derives the secret from the user's
    // current password hash to verify it.
    const reset_token = jwt.sign(
      { user_id: user.id },
      get_reset_token_secret({ config, user }),
      { expiresIn: '1h' }
    )

    const reset_link = `${config.url}/reset-password?token=${reset_token}`

    // A REFUSED SEND MUST NOT CHANGE THE STATUS CODE. sendEmail throws on a
    // provider refusal as of 61bb435b4, which was right -- resend resolves a
    // refusal as `{ error }` rather than throwing, so a dead key or an
    // unverified domain used to read as success. But letting that throw reach
    // the handler's catch answered 500, and only an account that EXISTS ever
    // reaches this line: an unknown one returned the generic 200 above without
    // attempting a send. So a refusing provider turned the status code into the
    // user-enumeration oracle the generic message exists to prevent -- 500 means
    // "this address is registered", 200 means it is not.
    //
    // The objection behind 61bb435b4 was never that the CALLER must see a
    // failure; it was that the failing path and the healthy path had the same
    // observable. This gives them different observables on the channel that
    // should carry the difference: the caller gets the same sentence either way,
    // and the operator gets a signal. Deliberately no email address in it -- a
    // signal is synced and indexed, and the address is the thing this route is
    // careful about.
    // A NOT-CONFIGURED MAILER IS THE THIRD OUTCOME, and ignoring the return
    // value left it the only silent one. sendEmail THROWS on a provider refusal
    // but RESOLVES `is_sent: false` when there is no mail provider at all --
    // deliberately, so a dev-mode form is not a 500. So if config.email or its
    // resend_api_key ever goes missing in production (a failed sops decrypt, a
    // rotated key, config drift), every reset request no-ops while still
    // answering "a password reset email has been sent": no throw, no signal, no
    // log line. That is the same both-paths-one-observable shape 61bb435b4
    // closed on the refusal branch, left open on this one.
    //
    // AND RECORD THE ACCEPTED MESSAGE ID, because this app receives no Resend
    // delivery webhook. `email_id` is the only handle that can answer "what
    // happened to that particular email" in the provider's own records later --
    // without it an accepted send leaves no trace at all, which is exactly why
    // a 2026-08-17 report of a missing reset email could not be answered from
    // anything this app had written down. Deliberately no email address in
    // either the log line or the signal: both are synced and indexed, and the
    // address is the thing this route is careful about.
    try {
      const { is_sent, email_id, reason } = await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        message: `Click the following link to reset your password: ${reset_link}. If you did not request a password reset, please ignore this email.`
      })

      if (is_sent) {
        logger(
          'password reset email accepted by provider user_id=%s email_id=%s',
          user.id,
          email_id
        )
      } else {
        auth_error_logger.error(
          `the password reset email was not sent: ${reason}`,
          {
            severity: 'high',
            fingerprint_override: 'auth-reset-password-send-unconfigured',
            context: { user_id: user.id }
          }
        )
      }
    } catch (email_error) {
      auth_error_logger.error(email_error, {
        severity: 'high',
        fingerprint_override: 'auth-reset-password-send-refused',
        context: { user_id: user.id }
      })
    }

    res.json({
      message: 'If an account exists, a password reset email has been sent'
    })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /auth/reset-password/confirm:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Complete a password reset
 *     description: Set a new password using the token emailed by POST /auth/reset-password. The token expires one hour after it is issued and stops verifying as soon as the password changes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Reset token from the emailed link's `token` query parameter
 *               password:
 *                 type: string
 *                 format: password
 *                 description: New password
 *                 example: mynewpassword123
 *             required:
 *               - token
 *               - password
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: password has been reset
 *               required:
 *                 - message
 *       400:
 *         description: Bad request - missing parameters, or an invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingToken:
 *                 summary: Missing token
 *                 value:
 *                   error: missing token param
 *               invalidToken:
 *                 summary: Invalid or expired token
 *                 value:
 *                   error: invalid or expired reset token
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
//
// SINGLE USE: a reset token is single-use in effect, and it costs no server
// state to get there. The token's signing secret is the jwt secret plus the
// user's bcrypt hash (`get_reset_token_secret` above), so the moment this
// route writes a new hash every token issued against the old one fails
// verification. That covers replay after a successful reset, and it also
// invalidates outstanding reset links when a password is changed through
// PUT /me — the case a `used` flag would miss.
//
// What it deliberately does NOT do is invalidate a token that was never used:
// an unused link stays valid for its full hour, and requesting a second reset
// does not revoke the first. Narrowing that further needs per-token server
// state, which `users` has no column for and which would be a schema change
// under db/README.md's workflow. The one-hour window is the accepted exposure.
//
router.post('/reset-password/confirm', async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    const { token, password } = req.body

    if (!token) {
      return res.status(400).send({ error: 'missing token param' })
    }

    if (!password) {
      return res.status(400).send({ error: 'missing password param' })
    }

    // Decoding is not verification — it only says which user's hash to build
    // the verification secret from. The jwt.verify below is the gate, and
    // nothing is written before it passes.
    const decoded = jwt.decode(token)
    const user_id = decoded ? decoded.user_id : null

    if (!user_id) {
      return res.status(400).send({ error: 'invalid or expired reset token' })
    }

    const user = await db('users').where({ id: user_id }).first()

    if (!user) {
      return res.status(400).send({ error: 'invalid or expired reset token' })
    }

    try {
      jwt.verify(token, get_reset_token_secret({ config, user }))
    } catch (verify_error) {
      return res.status(400).send({ error: 'invalid or expired reset token' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashed_password = await bcrypt.hash(password, salt)

    await db('users')
      .update({ password: hashed_password })
      .where({ id: user.id })

    res.json({ message: 'password has been reset' })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
