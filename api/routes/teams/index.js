const express = require('express')
const router = express.Router()

const activate = require('./activate')
const deactivate = require('./deactivate')
const release = require('./release')
const add = require('./add')
const lineups = require('./lineups')
const reserve = require('./reserve')

const { verifyUserTeam } = require('../../../utils')

router.put('/:teamId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { value, field } = req.body

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.user.userId, teamId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

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

router.use('/:teamId/activate', activate)
router.use('/:teamId/deactivate', deactivate)
router.use('/:teamId/release', release)
router.use('/:teamId/add', add)
router.use('/:teamId/lineups', lineups)
router.use('/:teamId/reserve', reserve)

module.exports = router
