import express from 'express'

import { constants } from '#common'
import { verifyUserTeam } from '#utils'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { processed, teamId } = req.query
    const type = parseInt(req.query.type, 10)

    if (!processed) {
      return res.status(400).send({ error: 'missing processed' })
    }

    if (!type) {
      return res.status(400).send({ error: 'missing type' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    // verify type
    const types = Object.values(constants.waivers)
    if (!types.includes(type)) {
      return res.status(400).send({ error: 'invalid type' })
    }

    const tid = parseInt(teamId, 10)

    // verify teamId, leagueId belongs to user
    try {
      await verifyUserTeam({
        userId: req.user.userId,
        leagueId,
        teamId: tid,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const waivers = await db('waivers')
      .where({
        lid: leagueId,
        type,
        processed
      })
      .where(function () {
        this.where('succ', 1)
          .orWhere({
            succ: 0,
            tid
          })
          .orWhere({
            succ: 0,
            reason: 'player is not a free agent' // TODO use code
          })
      })
    res.send(waivers)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
