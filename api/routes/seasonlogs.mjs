import express from 'express'

import { constants } from '#libs-shared'

const router = express.Router()

router.get('/teams', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const year = req.query.year || constants.season.year
    const { leagueId } = req.query

    const query = db('nfl_team_seasonlogs')
      .select('nfl_team_seasonlogs.*')
      .where('nfl_team_seasonlogs.year', year)

    if (leagueId) {
      query
        .select(
          'league_nfl_team_seasonlogs.pts',
          'league_nfl_team_seasonlogs.rnk'
        )
        .join('league_nfl_team_seasonlogs', function () {
          this.on('nfl_team_seasonlogs.year', 'league_nfl_team_seasonlogs.year')
          this.andOn(
            'nfl_team_seasonlogs.stat_key',
            'league_nfl_team_seasonlogs.stat_key'
          )
          this.andOn('nfl_team_seasonlogs.tm', 'league_nfl_team_seasonlogs.tm')
        })
    }

    const data = await query

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
