import express from 'express'

import { constants } from '#libs-shared'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    const year = req.query.year || constants.season.year

    const teamStats = await db('team_stats').where({
      lid: leagueId,
      year
    })
    res.send(teamStats)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
