import express from 'express'

import { getChartedPlayByPlayQuery, getPlayByPlayQuery } from '#libs-server'
import { constants } from '#libs-shared'

const router = express.Router()

// returns all nfl plays for the current week
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const query = getPlayByPlayQuery(db)
    const data = await query
      .where('nfl_plays_current_week.year', constants.season.year)
      .where('nfl_plays_current_week.seas_type', 'REG')
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

// returns all nfl play stats for the current week
router.get('/stats', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const data = await db('nfl_play_stats_current_week')
      .select('nfl_play_stats_current_week.*', 'nfl_plays_current_week.week')
      .leftJoin('nfl_plays_current_week', function () {
        this.on(
          'nfl_play_stats_current_week.esbid',
          '=',
          'nfl_plays_current_week.esbid'
        ).andOn(
          'nfl_play_stats_current_week.playId',
          '=',
          'nfl_plays_current_week.playId'
        )
      })
      .where('nfl_plays_current_week.year', constants.season.year)
      .where('nfl_plays_current_week.seas_type', 'REG')
      .where('nfl_play_stats_current_week.valid', 1)
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

// returns historical nfl plays
router.get('/charted', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const years = req.query.years
      ? Array.isArray(req.query.years)
        ? req.query.years
        : [req.query.years]
      : [
          constants.season.week
            ? constants.season.year
            : constants.season.year - 1
        ]

    const weeks = req.query.weeks
      ? Array.isArray(req.query.weeks)
        ? req.query.weeks
        : [req.query.weeks]
      : []

    const days = req.query.days
      ? Array.isArray(req.query.days)
        ? req.query.days
        : [req.query.days]
      : []

    const quarters = req.query.quarters
      ? Array.isArray(req.query.quarters)
        ? req.query.quarters
        : [req.query.quarters]
      : []

    const downs = req.query.downs
      ? Array.isArray(req.query.downs)
        ? req.query.downs
        : [req.query.downs]
      : []

    const { pid } = req.query

    // TODO filter by yfog range
    // TODO filter by ytg range
    // TODO filter by first drive
    // TODO filter by temperature
    // TODO filter by humidity
    // TODO filter by wind speed
    // TODO filter by day of week
    // TODO filter by spread
    // TODO filter by O/U

    // TODO - enable multiple years
    if (years.length > 1) {
      return res.status(400).send({ error: 'too many years listed' })
    }

    let query = getChartedPlayByPlayQuery(db)

    query = query.where('nfl_games.seas_type', 'REG')

    if (pid) {
      const player_rows = await db('player').where({ pid }).limit(1)
      const player_row = player_rows[0]
      query = query.where('nfl_plays.off', player_row.cteam)
    }

    if (years.length) {
      query = query.whereIn('nfl_games.year', years)
    }

    if (weeks.length) {
      query = query.whereIn('nfl_games.week', weeks)
    }

    if (days.length) {
      query = query.whereIn('nfl_games.day', days)
    }

    if (quarters.length) {
      query = query.whereIn('nfl_plays.qtr', quarters)
    }

    if (downs.length) {
      query = query.whereIn('nfl_plays.dwn', downs)
    }

    const data = await query
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
