import express from 'express'

import {
  getChartedPlayByPlayQuery,
  getPlayByPlayQuery,
  redis_cache
} from '#libs-server'
import { current_season } from '#constants'

const router = express.Router()

// ============================================================================
// CONSTANTS
// ============================================================================

// Cache TTL constants in seconds (Redis EX command expects seconds)
// Note: libs-server/data-views/cache-info-utils.mjs has similar constants in milliseconds
// for the data views caching system, but redis_cache uses seconds
const CACHE_TTL_15_MINUTES = 15 * 60
const CACHE_TTL_ONE_DAY = 24 * 60 * 60
const CACHE_TTL_ONE_WEEK = 7 * 24 * 60 * 60

// Historical plays query fields (shared between endpoints)
// Note: Similar to the fields array in libs-server/index.mjs for getPlayByPlayQuery,
// but this is for the historical nfl_plays table (not nfl_plays_current_week)
const HISTORICAL_PLAYS_FIELDS = [
  'nfl_plays.esbid',
  'nfl_plays.playId',
  'nfl_plays.sequence',
  'nfl_plays.dwn',
  'nfl_plays.desc',
  'nfl_plays.pos_team',
  'nfl_plays.off',
  'nfl_plays.def',
  'nfl_plays.year',
  'nfl_plays.week',
  'nfl_plays.qtr',
  'nfl_plays.yards_to_go',
  'nfl_plays.game_clock_start',
  'nfl_plays.ydl_end',
  'nfl_plays.ydl_start',
  'nfl_plays.first_down',
  'nfl_plays.goal_to_go',
  'nfl_plays.drive_play_count',
  'nfl_plays.timestamp',
  'nfl_plays.play_type_nfl',
  'nfl_plays.updated',
  'nfl_plays.qb_kneel',
  'nfl_games.h',
  'nfl_games.v'
]

// ============================================================================
// QUERY PARAMETER UTILITIES
// ============================================================================

/**
 * Normalizes a query parameter to an array, handling both single values and arrays
 */
function normalize_array_query_param(param_value) {
  if (!param_value) {
    return []
  }
  return Array.isArray(param_value) ? param_value : [param_value]
}

/**
 * Determines if the given week/year represents the current week
 */
function is_current_week({ week, year }) {
  return !week || (week === current_season.week && year === current_season.year)
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

/**
 * Builds a query for historical plays (non-current week)
 */
function build_historical_plays_query({ db, year, week }) {
  return db('nfl_plays')
    .select(HISTORICAL_PLAYS_FIELDS)
    .join('nfl_games', 'nfl_plays.esbid', '=', 'nfl_games.esbid')
    .where('nfl_plays.year', year)
    .where('nfl_plays.week', week)
    .where('nfl_plays.seas_type', 'REG')
}

/**
 * Builds a query for current week play stats
 */
function build_current_week_play_stats_query({ db }) {
  return db('nfl_play_stats_current_week')
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
    .where('nfl_plays_current_week.year', current_season.year)
    .where('nfl_plays_current_week.seas_type', 'REG')
    .where('nfl_play_stats_current_week.valid', true)
}

/**
 * Builds a query for historical play stats
 */
function build_historical_play_stats_query({ db, year, week }) {
  return db('nfl_play_stats')
    .select('nfl_play_stats.*', 'nfl_plays.week', 'nfl_plays.qb_kneel')
    .leftJoin('nfl_plays', function () {
      this.on('nfl_play_stats.esbid', '=', 'nfl_plays.esbid').andOn(
        'nfl_play_stats.playId',
        '=',
        'nfl_plays.playId'
      )
    })
    .where('nfl_plays.year', year)
    .where('nfl_plays.week', week)
    .where('nfl_plays.seas_type', 'REG')
    .where('nfl_play_stats.valid', true)
}

// ============================================================================
// CACHE UTILITIES
// ============================================================================

/**
 * Builds cache key for charted plays endpoint
 */
function build_charted_plays_cache_key({
  years,
  weeks,
  days,
  quarters,
  downs,
  pid
}) {
  let cache_key = `nfl_plays_charted_year_${years.join('_')}`

  if (pid) {
    cache_key = `${cache_key}_pid_${pid}`
  }
  if (weeks.length) {
    cache_key = `${cache_key}_weeks_${weeks.join('_')}`
  }
  if (days.length) {
    cache_key = `${cache_key}_days_${days.join('_')}`
  }
  if (quarters.length) {
    cache_key = `${cache_key}_quarters_${quarters.join('_')}`
  }
  if (downs.length) {
    cache_key = `${cache_key}_downs_${downs.join('_')}`
  }

  return cache_key
}

/**
 * Gets cache TTL duration based on current season type
 */
function get_cache_ttl_for_season_type() {
  const current_seas_type = current_season.nfl_seas_type
  return current_seas_type === 'REG' ? CACHE_TTL_ONE_DAY : CACHE_TTL_ONE_WEEK
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * @swagger
 * /plays:
 *   get:
 *     tags:
 *       - Plays
 *     summary: Get NFL plays for a specific week
 *     description: Retrieve all NFL plays for a specified week. If week and year are not provided, returns plays for the current regular season week. This endpoint returns detailed play-by-play data including down, distance, field position, and play outcome.
 *     parameters:
 *       - name: week
 *         in: query
 *         schema:
 *           type: integer
 *         description: Fantasy football week number
 *         example: 13
 *       - name: year
 *         in: query
 *         schema:
 *           type: integer
 *         description: Season year
 *         example: 2024
 *     responses:
 *       200:
 *         description: NFL plays for the specified week
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
    const week = req.query.week ? Number(req.query.week) : null
    const year = req.query.year ? Number(req.query.year) : current_season.year

    const query = is_current_week({ week, year })
      ? getPlayByPlayQuery(db)
          .where('nfl_plays_current_week.year', current_season.year)
          .where('nfl_plays_current_week.seas_type', 'REG')
      : build_historical_plays_query({ db, year, week })

    const data = await query
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
    year = current_season.year,
    seas_type = current_season.nfl_seas_type
  } = req.query

  try {
    const cache_key = `nfl_plays_all_${year}_${seas_type}`
    let data = await redis_cache.get(cache_key)

    if (!data) {
      data = await db('nfl_plays')
        .where('nfl_plays.year', year)
        .where('nfl_plays.seas_type', seas_type)

      await redis_cache.set(cache_key, data, CACHE_TTL_15_MINUTES)
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
 *     summary: Get NFL play statistics for a specific week
 *     description: Retrieve detailed statistics for all NFL plays from a specified week. If week and year are not provided, returns stats for the current regular season week. Includes player involvement and performance metrics.
 *     parameters:
 *       - name: week
 *         in: query
 *         schema:
 *           type: integer
 *         description: Fantasy football week number
 *         example: 13
 *       - name: year
 *         in: query
 *         schema:
 *           type: integer
 *         description: Season year
 *         example: 2024
 *     responses:
 *       200:
 *         description: NFL play statistics for the specified week
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
    const week = req.query.week ? Number(req.query.week) : null
    const year = req.query.year ? Number(req.query.year) : current_season.year
    const is_current_week_flag = is_current_week({ week, year })

    const query = is_current_week_flag
      ? build_current_week_play_stats_query({ db })
      : build_historical_play_stats_query({ db, year, week })

    const data = await query
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
    // Normalize query parameters to arrays
    const years = req.query.years
      ? normalize_array_query_param(req.query.years)
      : [current_season.week ? current_season.year : current_season.year - 1]
    const weeks = normalize_array_query_param(req.query.weeks)
    const days = normalize_array_query_param(req.query.days)
    const quarters = normalize_array_query_param(req.query.quarters)
    const downs = normalize_array_query_param(req.query.downs)
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

    // Build base query
    let query = getChartedPlayByPlayQuery(db).where(
      'nfl_games.seas_type',
      'REG'
    )

    // Apply player filter if provided
    if (pid) {
      const player_rows = await db('player').where({ pid }).limit(1)
      if (player_rows.length === 0) {
        return res.status(404).send({ error: 'player not found' })
      }
      const player_row = player_rows[0]
      query = query.where('nfl_plays.off', player_row.current_nfl_team)
    }

    // Apply filters
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

    // Check cache
    const cache_key = build_charted_plays_cache_key({
      years,
      weeks,
      days,
      quarters,
      downs,
      pid
    })
    const cache_data = await redis_cache.get(cache_key)

    if (cache_data) {
      return res.send(cache_data)
    }

    // Execute query and cache result
    const data = await query
    const cache_duration = get_cache_ttl_for_season_type()
    await redis_cache.set(cache_key, data, cache_duration)

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
