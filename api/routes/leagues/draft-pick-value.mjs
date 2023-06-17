import express from 'express'

import { getLeague } from '#libs-server'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { leagueId } = req.params

    const league = await getLeague({ lid: leagueId })

    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const data = await db('league_format_draft_pick_value')
      .select(
        'rank',
        'median_best_season_points_added_per_game',
        'median_career_points_added_per_game'
      )
      .where({ league_format_hash: league.league_format_hash })
    res.send(data)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
