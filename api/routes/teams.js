const express = require('express')
const router = express.Router()

const { getRoster } = require('../../utils')
const { constants } = require('../../common')

router.put('/:teamId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { value, field } = req.body

    const userTeamFields = ['teamtext', 'teamvoice', 'leaguetext']
    const fields = ['name', 'image', 'abbrv', ...userTeamFields]

    if (!field) {
      return res.status(400).send({ error: 'missing field' })
    }

    if (typeof value === 'undefined' || value === null) {
      return res.status(400).send({ error: 'missing value' })
    }

    if (fields.indexOf(field) < 0) {
      return res.status(400).send({ error: 'invalid field' })
    }

    if (field === 'image') {
      // TODO validate url
    }

    if (userTeamFields.indexOf(field) < 0) {
      await db('teams').update({ [field]: value }).where({ uid: teamId })
    } else {
      await db('users_teams')
        .update({ [field]: value })
        .where({ tid: teamId, userid: req.user.userId })
    }
    res.send({ value })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:teamId/lineups/?', async (req, res) => {
  const { db } = req.app.locals
  const { teamId } = req.params
  const week = req.query.week || constants.week
  const year = req.query.year || constants.year

  const tid = parseInt(teamId, 10)

  const teams = await db('users_teams').where({ userid: req.user.userId })
  const teamIds = teams.map(r => r.tid)

  if (!teamIds.includes(tid)) {
    return res.status(401).send({ error: 'you do not have access to this teamId' })
  }

  const roster = await getRoster({ db, tid, week, year })
  res.send(roster)
})

router.put('/:teamId/lineups/?', async (req, res) => {
  // TODO set team game lineup
})

router.get('/:teamId/settings', async (req, res) => {
  // TODO get team settings
})

router.put('/:teamId/settings', async (req, res) => {
  // TODO set team settings
})

module.exports = router
