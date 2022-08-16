import express from 'express'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { leagueId } = req.params

    const data = await db('league_draft_pick_value')
      .select(
        'rank',
        'median_best_season_points_added_per_game',
        'median_career_points_added_per_game'
      )
      .where({ lid: leagueId })
    res.send(data)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
