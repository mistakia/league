import express from 'express'

import {
  getChartedPlayByPlayQuery,
  getPlayByPlayQuery,
  redis_cache
} from '#libs-server'
import { constants } from '#libs-shared'

const router = express.Router()

/**
 * @swagger
 * /plays:
 *   get:
 *     tags:
 *       - Plays
 *     summary: Get current week NFL plays
 *     description: Retrieve all NFL plays for the current regular season week. This endpoint returns detailed play-by-play data including down, distance, field position, and play outcome.
 *     responses:
 *       200:
 *         description: Current week NFL plays
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NFLPlay'
 *             examples:
 *               current_week_plays:
 *                 summary: Sample current week plays
 *                 value:
 *                   - esbid: "2024120801"
 *                     playId: 1
 *                     year: 2024
 *                     week: 13
 *                     seas_type: "REG"
 *                     off: "KC"
 *                     def: "LV"
 *                     down: 1
 *                     yards_to_go: 10
 *                     yfog: 25
 *                     play_type: "RUSH"
 *                     yards_gained: 7
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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

/**
 * @swagger
 * /plays/all:
 *   get:
 *     tags:
 *       - Plays
 *     summary: Get all NFL plays by season
 *     description: Retrieve all NFL plays for a specified season and season type. Results are cached for 15 minutes to improve performance.
 *     parameters:
 *       - $ref: '#/components/parameters/year'
 *       - $ref: '#/components/parameters/seasonType'
 *     responses:
 *       200:
 *         description: All NFL plays for the specified season
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NFLPlay'
 *             examples:
 *               season_plays:
 *                 summary: Sample season plays
 *                 value:
 *                   - esbid: "2024120801"
 *                     playId: 1
 *                     year: 2024
 *                     week: 13
 *                     seas_type: "REG"
 *                     off: "KC"
 *                     def: "LV"
 *                     down: 1
 *                     yards_to_go: 10
 *                     yfog: 25
 *                     play_type: "RUSH"
 *                     yards_gained: 7
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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

      // Cache for 15 minutes
      await redis_cache.set(cache_key, data, 15 * 60)
    }

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /plays/stats:
 *   get:
 *     tags:
 *       - Plays
 *     summary: Get current week NFL play statistics
 *     description: Retrieve detailed statistics for all NFL plays from the current regular season week, including player involvement and performance metrics.
 *     responses:
 *       200:
 *         description: Current week NFL play statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NFLPlayStats'
 *             examples:
 *               play_stats:
 *                 summary: Sample play statistics
 *                 value:
 *                   - esbid: "2024120801"
 *                     playId: 1
 *                     week: 13
 *                     pid: "PATR-MAHO-2017-1995-09-17"
 *                     stat_type: "PASSING"
 *                     yards: 15
 *                     touchdown: false
 *                     interception: false
 *                     valid: true
 *                     qb_kneel: false
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/stats', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const data = await db('nfl_play_stats_current_week')
      .select(
        'nfl_play_stats_current_week.*',
        'nfl_plays_current_week.week',
        'nfl_plays_current_week.qb_kneel'
      )
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

/**
 * @swagger
 * /plays/charted:
 *   get:
 *     tags:
 *       - Plays
 *     summary: Get historical NFL plays with advanced filtering
 *     description: Retrieve historical NFL plays with comprehensive filtering options including years, weeks, days, quarters, downs, and player/team filters. Results are cached based on season type.
 *     parameters:
 *       - name: years
 *         in: query
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: array
 *               items:
 *                 type: integer
 *         description: Filter by specific year(s)
 *         example: [2023, 2024]
 *       - name: weeks
 *         in: query
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: array
 *               items:
 *                 type: integer
 *         description: Filter by specific week(s)
 *         example: [1, 2, 3]
 *       - name: days
 *         in: query
 *         schema:
 *           oneOf:
 *             - type: string
 *             - type: array
 *               items:
 *                 type: string
 *         description: Filter by day(s) of the week
 *         example: ["Sunday", "Monday"]
 *       - name: quarters
 *         in: query
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: array
 *               items:
 *                 type: integer
 *         description: Filter by quarter(s)
 *         example: [1, 2, 3, 4]
 *       - name: downs
 *         in: query
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: array
 *               items:
 *                 type: integer
 *         description: Filter by down(s)
 *         example: [1, 2, 3, 4]
 *       - name: pid
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by player ID (shows plays for their team)
 *         example: "PATR-MAHO-2017-1995-09-17"
 *     responses:
 *       200:
 *         description: Historical NFL plays matching filters
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NFLPlayCharted'
 *             examples:
 *               charted_plays:
 *                 summary: Sample charted plays
 *                 value:
 *                   - esbid: "2024120801"
 *                     playId: 1
 *                     year: 2024
 *                     week: 13
 *                     day: "Sunday"
 *                     seas_type: "REG"
 *                     off: "KC"
 *                     def: "LV"
 *                     down: 1
 *                     yards_to_go: 10
 *                     yfog: 25
 *                     qtr: 1
 *                     play_type: "RUSH"
 *                     yards_gained: 7
 *                     bc_pid: "PATR-MAHO-2017-1995-09-17"
 *                     rush_yds: 7
 *                     first_down: false
 *                     successful_play: true
 *                     dwn: 1
 *                     dot: 75
 *                     ydl_100: 25
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *         examples:
 *           too_many_years:
 *             summary: Too many years specified
 *             value:
 *               error: "too many years listed"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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
