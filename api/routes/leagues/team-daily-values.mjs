import express from 'express'

import { getLeague } from '#utils'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { leagueId } = req.params

    const league = await getLeague({ lid: leagueId })

    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const data = await db('league_team_daily_values').where({ lid: leagueId })
    res.send(data)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
