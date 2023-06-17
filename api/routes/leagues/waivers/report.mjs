import express from 'express'

import { constants } from '#libs-shared'
import { verifyUserTeam } from '#libs-server'

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

    // verify type
    const types = Object.values(constants.waivers)
    if (!types.includes(type)) {
      return res.status(400).send({ error: 'invalid type' })
    }

    const query = db('waivers').where({
      lid: leagueId,
      type,
      processed
    })

    // verify teamId and get failed bids for teamId
    if (teamId) {
      const tid = parseInt(teamId, 10)

      // verify teamId, leagueId belongs to user
      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      query.where(function () {
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
    } else {
      // show successful bids or only failed bids due to player no longer being a free agent
      query.where(function () {
        this.where('succ', 1).orWhere({
          succ: 0,
          reason: 'player is not a free agent' // TODO use code
        })
      })
    }

    const waivers = await query
    res.send(waivers)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
