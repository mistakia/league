import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import { constants } from '#libs-shared'
import { createLeague, getLeague } from '#libs-server'

const router = express.Router()

router.post('/login', async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    const { email, password } = req.body
    if (!email) {
      return res.status(400).send({ error: 'missing email param' })
    }

    if (!password) {
      return res.status(400).send({ error: 'missing password param' })
    }

    const users = await db('users').where({ email })
    if (!users.length) {
      return res.status(400).send({ error: 'invalid params' })
    }

    const user = users[0]
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
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
    const { email, password } = req.body
    let username = req.body.username

    let teamId = req.body.teamId ? parseInt(req.body.teamId, 10) : null
    let leagueId = req.body.leagueId ? parseInt(req.body.leagueId, 10) : null

    if (!email) {
      return res.status(400).send({ error: 'missing email param' })
    }

    if (!password) {
      return res.status(400).send({ error: 'missing password param' })
    }

    if (email.length > 60) {
      return res.status(400).send({ error: 'email too long' })
    }

    const emailExists = await db('users').where({ email })
    if (emailExists.length) {
      return res.status(400).send({ error: 'email exists' })
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

    if (username.length < 3) {
      return res.status(400).send({ error: 'username too short' })
    }

    if (username.length > 60) {
      return res.status(400).send({ error: 'username too long' })
    }

    const usernameExists = await db('users').where({ username })
    if (usernameExists.length) {
      return res.status(400).send({ error: 'username exists' })
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
    const users = await db('users').insert({
      email,
      password: hashedPassword,
      username
    })
    const userId = users[0]

    if (!leagueId) {
      leagueId = await createLeague({ commishid: userId })

      const teams = await db('teams').insert({
        lid: leagueId,
        name: 'Team Name',
        abbrv: 'TM',
        year: constants.season.year
      })
      teamId = teams[0]
    }

    if (!req.body.teamId) {
      await db('rosters').insert({
        tid: teamId,
        lid: leagueId,
        week: constants.season.week,
        year: constants.season.year,
        last_updated: Math.round(Date.now() / 1000)
      })
    }

    await db('users_teams').insert({
      userid: userId,
      tid: teamId
    })

    const token = jwt.sign({ userId }, config.jwt.secret)
    res.json({ token, userId })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
