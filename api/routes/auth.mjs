import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import { constants } from '#libs-shared'
import { getLeague, sendEmail, validators } from '#libs-server'

const router = express.Router()

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

router.post('/register', async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    const { email, password, invite_code } = req.body
    let username = req.body.username

    const teamId = req.body.teamId ? parseInt(req.body.teamId, 10) : null
    const leagueId = req.body.leagueId ? parseInt(req.body.leagueId, 10) : null

    if (!password) {
      return res.status(400).send({ error: 'missing password param' })
    }

    if (email) {
      const result = validators.email_validator({ email })
      if (result !== true) {
        return res.status(400).send({ error: result[0].message })
      }

      const emailExists = await db('users').where({ email })
      if (emailExists.length) {
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

    const usernameExists = await db('users').where({ username })
    if (usernameExists.length) {
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

    if (leagueId) {
      const league = getLeague({ lid: leagueId })
      if (!league) {
        return res.status(400).send({ error: 'league does not exist' })
      }

      const teams = await db('teams').where({
        lid: leagueId,
        year: constants.season.year
      })
      if (teamId) {
        if (!teams.find((t) => t.uid === teamId)) {
          return res.status(400).send({ error: 'team does not exist' })
        }
      } else if (teams.length === league.num_teams) {
        return res.status(400).send({ error: 'league full' })
      }
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    const users = await db('users')
      .insert({
        email,
        password: hashedPassword,
        username,
        invite_code
      })
      .returning('id')
    const userId = users[0].id

    // Update invite code usage
    await db('invite_codes')
      .where({ code: invite_code })
      .update({
        used_by: userId,
        used_at: db.fn.now(),
        uses_count: db.raw('uses_count + 1')
      })

    if (leagueId && teamId) {
      await db('users_teams').insert({
        userid: userId,
        tid: teamId
      })
    }

    const token = jwt.sign({ userId }, config.jwt.secret)
    res.json({ token, userId })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

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
