import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import { constants } from '#libs-shared'
import { getLeague, sendEmail, validators } from '#libs-server'

const router = express.Router()

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

    const team_id = req.body.teamId ? parseInt(req.body.teamId, 10) : null
    const league_id = req.body.leagueId ? parseInt(req.body.leagueId, 10) : null

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
        year: constants.season.year
      })
      if (team_id) {
        if (!teams.find((t) => t.uid === team_id)) {
          return res.status(400).send({ error: 'team does not exist' })
        }
      } else if (teams.length === league.num_teams) {
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
        year: constants.season.year
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
 *         description: Bad request - missing required parameters or user not found (when username provided without email)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingParams:
 *                 summary: Missing username or email
 *                 value:
 *                   error: missing username or email
 *               userNotFound:
 *                 summary: User not found (username only)
 *                 value:
 *                   error: user not found
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

    if (!user) {
      if (!email) {
        return res.status(400).send({ error: 'user not found' })
      } else {
        return res.status(200).send({
          message: 'If an account exists, a password reset email has been sent'
        })
      }
    }

    const reset_token = jwt.sign({ user_id: user.id }, config.jwt.secret, {
      expiresIn: '1h'
    })

    await db('users').where({ id: user.id }).update({ reset_token })

    const reset_link = `${config.url}/reset-password?token=${reset_token}`

    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `Click the following link to reset your password: ${reset_link}. If you did not request a password reset, please ignore this email.`
    })

    res.json({
      message: 'If an account exists, a password reset email has been sent'
    })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
