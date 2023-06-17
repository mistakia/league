import express from 'express'

import { verifyUserTeam } from '#libs-server'
import activate from './activate.mjs'
import cutlist from './cutlist.mjs'
import deactivate from './deactivate.mjs'
import release from './release.mjs'
import add from './add.mjs'
import lineups from './lineups.mjs'
import reserve from './reserve.mjs'
import protect from './protect.mjs'
import tag from './tag.mjs'
import transactions from './transactions.mjs'
import players from './players.mjs'
import { constants } from '#libs-shared'

const router = express.Router()

router.put('/:teamId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { value, field } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.auth.userId, teamId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const userTeamFields = ['teamtext', 'teamvoice', 'leaguetext']
    const fields = ['name', 'image', 'abbrv', 'pc', 'ac', ...userTeamFields]

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

    if (['pc', 'ac'].includes(field)) {
      if (typeof value !== 'string' || value.length !== 6) {
        return res.status(400).send({ error: 'invalid value' })
      }
    }

    if (userTeamFields.indexOf(field) < 0) {
      await db('teams')
        .update({ [field]: value })
        .where({ uid: teamId, year: constants.season.year })
    } else {
      await db('users_teams')
        .update({ [field]: value })
        .where({ tid: teamId, userid: req.auth.userId })
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
router.use('/:teamId/protect', protect)
router.use('/:teamId/tag', tag)
router.use('/:teamId/cutlist', cutlist)
router.use('/:teamId/transactions', transactions)
router.use('/:teamId/players', players)

export default router
