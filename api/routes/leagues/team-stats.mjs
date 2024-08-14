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

    const league_team_seasonlogs = await db('league_team_seasonlogs').where({
      lid: leagueId,
      year
    })
    res.send(league_team_seasonlogs)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
