import express from 'express'

import {
  getChartedPlayByPlayQuery,
  getPlayByPlayQuery,
  redis_cache
} from '#libs-server'
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

router.get('/all', async (req, res) => {
  const { db, logger } = req.app.locals
  const {
    year = constants.season.year,
    seas_type = constants.season.nfl_seas_type
  } = req.query

  try {
    const cache_key = `nfl_plays_all_${year}_${seas_type}`
    let data = await redis_cache.get(cache_key)

    if (!data) {
      data = await db('nfl_plays')
        .where('nfl_plays.year', year)
        .where('nfl_plays.seas_type', seas_type)

      await redis_cache.set(cache_key, data, 15 * 60) // Cache for 15 minutes
    }

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
      .where('nfl_play_stats_current_week.valid', true)
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
    // TODO filter by yards_to_go range
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
    let cache_key = `nfl_plays_charted_year_${years.join('_')}`

    if (pid) {
      const player_rows = await db('player').where({ pid }).limit(1)
      const player_row = player_rows[0]
      query = query.where('nfl_plays.off', player_row.current_nfl_team)
      cache_key = `${cache_key}_pid_${pid}`
    }

    if (years.length) {
      query = query.whereIn('nfl_games.year', years)
    }

    if (weeks.length) {
      query = query.whereIn('nfl_games.week', weeks)
      cache_key = `${cache_key}_weeks_${weeks.join('_')}`
    }

    if (days.length) {
      query = query.whereIn('nfl_games.day', days)
      cache_key = `${cache_key}_days_${days.join('_')}`
    }

    if (quarters.length) {
      query = query.whereIn('nfl_plays.qtr', quarters)
      cache_key = `${cache_key}_quarters_${quarters.join('_')}`
    }

    if (downs.length) {
      query = query.whereIn('nfl_plays.dwn', downs)
      cache_key = `${cache_key}_downs_${downs.join('_')}`
    }

    const cache_data = await redis_cache.get(cache_key)

    if (cache_data) {
      return res.send(cache_data)
    }

    const data = await query

    const current_seas_type = constants.season.nfl_seas_type
    const cache_ttl_one_day = 24 * 60 * 60
    const cache_ttl_one_week = 7 * 24 * 60 * 60
    const cache_duration =
      current_seas_type === 'REG' ? cache_ttl_one_day : cache_ttl_one_week

    await redis_cache.set(cache_key, data, cache_duration)

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
