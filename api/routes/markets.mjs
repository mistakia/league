import express from 'express'
import Validator from 'fastest-validator'

import { constants, bookmaker_constants } from '#libs-shared'
import cache from '#api/cache.mjs'

const router = express.Router()
const v = new Validator({ haltOnFirstError: true })

// Validation schemas
const bookmaker_schema = {
  type: 'enum',
  values: Object.values(bookmaker_constants.bookmakers),
  $$root: true
}

const limit_schema = {
  type: 'number',
  optional: true,
  integer: true,
  min: 1,
  max: 1000,
  $$root: true
}

const offset_schema = {
  type: 'number',
  optional: true,
  integer: true,
  min: 0,
  $$root: true
}

const time_type_schema = {
  type: 'enum',
  values: Object.values(bookmaker_constants.time_type),
  optional: true,
  $$root: true
}

const market_type_schema = {
  type: 'string',
  optional: true,
  $$root: true
}

const player_id_schema = {
  type: 'string',
  optional: true,
  pattern: /^[a-zA-Z0-9-]+$/,
  $$root: true
}

const game_id_schema = {
  type: 'string',
  optional: true,
  pattern: /^[a-zA-Z0-9-]+$/,
  $$root: true
}

// Compile validators for query parameter validation

// Query parameter validation schemas
const prop_markets_base_query_schema = {
  week: { type: 'number', optional: true, integer: true, min: 1, max: 30 },
  year: {
    type: 'number',
    optional: true,
    integer: true,
    min: 1920,
    max: constants.season.year
  },
  seas_type: { type: 'string', optional: true, enum: constants.seas_types },
  bookmaker: bookmaker_schema,
  limit: limit_schema,
  offset: offset_schema
}

const prop_markets_main_query_schema = {
  ...prop_markets_base_query_schema,
  time_type: time_type_schema,
  market_type: market_type_schema,
  player_id: player_id_schema,
  game_id: game_id_schema,
  include_selections: { type: 'boolean', optional: true, default: true }
}

const prop_markets_history_query_schema = {
  start_time: { type: 'string', optional: true },
  end_time: { type: 'string', optional: true },
  limit: limit_schema,
  offset: offset_schema
}

const prop_markets_main_query_validator = v.compile(
  prop_markets_main_query_schema
)
const prop_markets_history_query_validator = v.compile(
  prop_markets_history_query_schema
)
const prop_markets_base_query_validator = v.compile(
  prop_markets_base_query_schema
)

/**
 * @swagger
 * /markets:
 *   get:
 *     tags:
 *       - Markets
 *     summary: Get betting markets
 *     description: Retrieve betting markets with optional filtering by various parameters
 *     parameters:
 *       - $ref: '#/components/parameters/week'
 *       - $ref: '#/components/parameters/year'
 *       - name: seas_type
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/SeasonTypeEnum'
 *         description: Season type
 *       - name: bookmaker
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/BookmakerEnum'
 *           default: FANDUEL
 *         description: Sportsbook name
 *         example: DRAFTKINGS
 *       - name: time_type
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/TimeTypeEnum'
 *           default: CLOSE
 *         description: Market time type
 *       - name: market_type
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/MarketTypeEnum'
 *         description: Type of betting market
 *         example: GAME_PASSING_YARDS
 *       - name: player_id
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by specific player
 *       - name: game_id
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by specific game
 *       - name: include_selections
 *         in: query
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include betting selections in response
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Number of markets to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of markets to skip
 *     responses:
 *       200:
 *         description: List of betting markets
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BettingMarket'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    // Parse parameters - week is optional for non-game markets like season futures
    const params = {
      week: req.query.week ? Number(req.query.week) : undefined,
      year: req.query.year ? Number(req.query.year) : undefined,
      seas_type: req.query.seas_type,
      bookmaker: req.query.bookmaker || 'FANDUEL',
      time_type: req.query.time_type || 'CLOSE',
      market_type: req.query.market_type,
      player_id: req.query.player_id,
      game_id: req.query.game_id,
      include_selections: req.query.include_selections !== 'false',
      limit: Number(req.query.limit) || 1000,
      offset: Number(req.query.offset) || 0
    }

    // Validate parameters
    const validation_result = prop_markets_main_query_validator(params)
    if (validation_result !== true) {
      return res.status(400).send({
        error: `invalid query parameters: ${validation_result[0].message}`
      })
    }

    // Build cache key
    const cache_key_parts = [
      'markets',
      params.year || 'all',
      params.week || 'all',
      params.seas_type || 'all',
      params.bookmaker,
      params.time_type,
      params.market_type || 'all',
      params.player_id || 'all',
      params.game_id || 'all',
      params.include_selections,
      params.limit,
      params.offset
    ]
    const cache_key = cache_key_parts.join('/')
    const cached_markets = cache.get(cache_key)
    if (cached_markets) {
      return res.send(cached_markets)
    }

    // Build markets query
    let markets_query = db('prop_markets_index')
      .select('prop_markets_index.*')
      .where('prop_markets_index.source_id', params.bookmaker)
      .where('prop_markets_index.time_type', params.time_type)

    // Handle year filtering - use prop_markets_index.year if only year is provided
    if (
      params.year !== undefined &&
      params.week === undefined &&
      !params.seas_type
    ) {
      markets_query = markets_query.where(
        'prop_markets_index.year',
        params.year
      )
    }
    // Only join with nfl_games if we need to filter by week/seas_type or year with other game fields
    else if (
      params.week !== undefined ||
      params.seas_type ||
      (params.year !== undefined &&
        (params.week !== undefined || params.seas_type))
    ) {
      markets_query = markets_query.leftJoin(
        'nfl_games',
        'prop_markets_index.esbid',
        'nfl_games.esbid'
      )

      if (params.week !== undefined) {
        markets_query = markets_query.where('nfl_games.week', params.week)
      }
      if (params.year !== undefined) {
        markets_query = markets_query.where('nfl_games.year', params.year)
      }
      if (params.seas_type) {
        markets_query = markets_query.where(
          'nfl_games.seas_type',
          params.seas_type
        )
      }
    }

    // Add optional filters
    if (params.market_type) {
      markets_query = markets_query.where(
        'prop_markets_index.market_type',
        params.market_type
      )
    }

    if (params.player_id) {
      markets_query = markets_query.where(
        'prop_markets_index.selection_pid',
        params.player_id
      )
    }

    if (params.game_id) {
      markets_query = markets_query.where(
        'prop_markets_index.esbid',
        params.game_id
      )
    }

    // Add pagination
    markets_query = markets_query.limit(params.limit).offset(params.offset)

    const markets_data = await markets_query

    if (markets_data.length === 0) {
      return res.send([])
    }

    // Include selections if requested (default true)
    if (params.include_selections) {
      const source_market_ids = markets_data.map(
        (market) => market.source_market_id
      )

      const selections_data = await db('prop_market_selections_index')
        .select('prop_market_selections_index.*')
        .whereIn(
          'prop_market_selections_index.source_market_id',
          source_market_ids
        )

      const markets_index = {}
      for (const market of markets_data) {
        market.selections = []
        markets_index[market.source_market_id] = market
      }

      for (const selection of selections_data) {
        const market = markets_index[selection.source_market_id]
        if (market) {
          market.selections.push(selection)
        }
      }

      const markets_array = Object.values(markets_index)

      // Cache result for 15 minutes
      cache.set(cache_key, markets_array, 900)
      res.send(markets_array)
    } else {
      // Return markets without selections
      cache.set(cache_key, markets_data, 900)
      res.send(markets_data)
    }
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /markets/{source_market_id}/history:
 *   get:
 *     tags:
 *       - Markets
 *     summary: Get historical data for a specific betting market
 *     description: |
 *       Retrieve historical odds and line movement data for a specific betting market.
 *       This endpoint provides time-series data showing how odds and lines have changed over time.
 *     parameters:
 *       - name: source_market_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the betting market from the sportsbook
 *         example: "dk_123456789"
 *       - name: start_time
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start timestamp for historical data (ISO 8601 format)
 *         example: "2024-01-01T00:00:00Z"
 *       - name: end_time
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End timestamp for historical data (ISO 8601 format)
 *         example: "2024-01-31T23:59:59Z"
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of historical records to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of records to skip (for pagination)
 *     responses:
 *       200:
 *         description: Historical market data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   source_market_id:
 *                     type: string
 *                     description: Market identifier from sportsbook
 *                     example: "dk_123456789"
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     description: When this data point was recorded
 *                     example: "2024-01-15T14:30:00Z"
 *                   market_type:
 *                     $ref: '#/components/schemas/MarketTypeEnum'
 *                   source_id:
 *                     $ref: '#/components/schemas/BookmakerEnum'
 *                   open:
 *                     type: boolean
 *                     description: Whether market was open at this time
 *                     example: true
 *                   live:
 *                     type: boolean
 *                     nullable: true
 *                     description: Whether market was live at this time
 *                     example: false
 *                   settled:
 *                     type: boolean
 *                     description: Whether market was settled at this time
 *                     example: false
 *                   odds_data:
 *                     type: object
 *                     description: Historical odds and line data
 *                     additionalProperties: true
 *             examples:
 *               player_prop_history:
 *                 summary: Player prop historical data
 *                 value:
 *                   - source_market_id: "dk_123456789"
 *                     timestamp: "2024-01-15T14:30:00Z"
 *                     market_type: "GAME_PASSING_YARDS"
 *                     source_id: "DRAFTKINGS"
 *                     open: true
 *                     live: false
 *                     settled: false
 *                     odds_data: {}
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         description: Market not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "market not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:source_market_id/history', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { source_market_id } = req.params
    const params = {
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      limit: Number(req.query.limit) || 1000,
      offset: Number(req.query.offset) || 0
    }

    if (!source_market_id) {
      return res
        .status(400)
        .send({ error: 'missing source_market_id parameter' })
    }

    const validation_result = prop_markets_history_query_validator(params)
    if (validation_result !== true) {
      return res.status(400).send({
        error: `invalid query parameters: ${validation_result[0].message}`
      })
    }

    const cache_key = `/markets/history/${source_market_id}/${params.start_time || 'all'}/${params.end_time || 'all'}/${params.limit}/${params.offset}`
    const cached_data = cache.get(cache_key)
    if (cached_data) {
      return res.send(cached_data)
    }

    let query = db('prop_markets_history')
      .select('prop_markets_history.*')
      .where('prop_markets_history.source_market_id', source_market_id)

    if (params.start_time) {
      query = query.where(
        'prop_markets_history.timestamp',
        '>=',
        params.start_time
      )
    }

    if (params.end_time) {
      query = query.where(
        'prop_markets_history.timestamp',
        '<=',
        params.end_time
      )
    }

    const markets_history = await query
      .orderBy('prop_markets_history.timestamp', 'desc')
      .limit(params.limit)
      .offset(params.offset)

    cache.set(cache_key, markets_history, 900)
    res.send(markets_history)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /markets/players/{pid}:
 *   get:
 *     tags:
 *       - Markets
 *     summary: Get betting markets for a specific player
 *     description: |
 *       Retrieve all betting markets available for a specific player, including prop bets
 *       for passing, rushing, receiving, and other statistical categories. Markets are
 *       returned with their associated betting selections and current odds.
 *     parameters:
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9-]+$'
 *         description: Player ID in format FFFF-LLLL-YYYY-YYYY-MM-DD
 *         example: "PATR-MAHO-2017-1995-09-17"
 *       - $ref: '#/components/parameters/week'
 *       - $ref: '#/components/parameters/year'
 *       - name: seas_type
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/SeasonTypeEnum'
 *         description: Season type (REG=Regular season, POST=Playoffs, PRE=Preseason)
 *       - name: bookmaker
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/BookmakerEnum'
 *           default: FANDUEL
 *         description: Sportsbook to retrieve markets from
 *         example: DRAFTKINGS
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of markets to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of markets to skip (for pagination)
 *     responses:
 *       200:
 *         description: Player markets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/BettingMarket'
 *                   - type: object
 *                     properties:
 *                       selection_pid:
 *                         type: string
 *                         description: Player ID this market is for
 *                         example: "PATR-MAHO-2017-1995-09-17"
 *                       source_market_id:
 *                         type: string
 *                         description: Unique market identifier from sportsbook
 *                         example: "dk_123456789"
 *                       time_type:
 *                         $ref: '#/components/schemas/TimeTypeEnum'
 *             examples:
 *               quarterback_markets:
 *                 summary: QB prop markets
 *                 value:
 *                   - market_type: "GAME_PASSING_YARDS"
 *                     source_id: "DRAFTKINGS"
 *                     source_market_name: "Patrick Mahomes - Passing Yards"
 *                     esbid: "2025012601"
 *                     open: true
 *                     live: false
 *                     settled: false
 *                     selection_pid: "PATR-MAHO-2017-1995-09-17"
 *                     selections:
 *                       - selection_name: "Over"
 *                         selection_type: "OVER"
 *                         selection_metric_line: 267.5
 *                         odds_decimal: 1.909
 *                         odds_american: -110
 *                       - selection_name: "Under"
 *                         selection_type: "UNDER"
 *                         selection_metric_line: 267.5
 *                         odds_decimal: 1.909
 *                         odds_american: -110
 *               running_back_markets:
 *                 summary: RB prop markets
 *                 value:
 *                   - market_type: "GAME_RUSHING_YARDS"
 *                     source_id: "FANDUEL"
 *                     source_market_name: "Christian McCaffrey - Rushing Yards"
 *                     esbid: "2025012601"
 *                     open: true
 *                     live: false
 *                     settled: false
 *                     selection_pid: "CHRI-MCCA-2017-1996-06-07"
 *                     selections:
 *                       - selection_name: "Over"
 *                         selection_type: "OVER"
 *                         selection_metric_line: 89.5
 *                         odds_decimal: 1.833
 *                         odds_american: -120
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         description: Player not found or no markets available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "missing player ID parameter"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/players/:pid', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params
    const params = {
      week: req.query.week ? Number(req.query.week) : undefined,
      year: req.query.year ? Number(req.query.year) : undefined,
      seas_type: req.query.seas_type,
      bookmaker: req.query.bookmaker || 'FANDUEL',
      limit: Number(req.query.limit) || 1000,
      offset: Number(req.query.offset) || 0
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing player ID parameter' })
    }

    const validation_result = prop_markets_base_query_validator(params)
    if (validation_result !== true) {
      return res.status(400).send({
        error: `invalid query parameters: ${validation_result[0].message}`
      })
    }

    const cache_key = `/markets/players/${pid}/${params.year || 'all'}/${params.week || 'all'}/${params.seas_type || 'all'}/${params.bookmaker}/${params.limit}/${params.offset}`
    const cached_data = cache.get(cache_key)
    if (cached_data) {
      return res.send(cached_data)
    }

    let markets_query = db('prop_markets_index')
      .select('prop_markets_index.*')
      .where('prop_markets_index.source_id', params.bookmaker)
      .where('prop_markets_index.selection_pid', pid)

    // Only join with nfl_games if we need to filter by week/year/seas_type
    if (
      params.week !== undefined ||
      params.year !== undefined ||
      params.seas_type
    ) {
      markets_query = markets_query.leftJoin(
        'nfl_games',
        'prop_markets_index.esbid',
        'nfl_games.esbid'
      )

      if (params.week !== undefined) {
        markets_query = markets_query.where('nfl_games.week', params.week)
      }
      if (params.year !== undefined) {
        markets_query = markets_query.where('nfl_games.year', params.year)
      }
      if (params.seas_type) {
        markets_query = markets_query.where(
          'nfl_games.seas_type',
          params.seas_type
        )
      }
    }

    const markets_data = await markets_query
      .limit(params.limit)
      .offset(params.offset)

    // Get selections for each market
    const source_market_ids = markets_data.map((m) => m.source_market_id)
    if (source_market_ids.length > 0) {
      const selections_data = await db('prop_market_selections_index')
        .select('prop_market_selections_index.*')
        .whereIn(
          'prop_market_selections_index.source_market_id',
          source_market_ids
        )

      const markets_index = {}
      for (const market of markets_data) {
        market.selections = []
        markets_index[market.source_market_id] = market
      }

      for (const selection of selections_data) {
        const market = markets_index[selection.source_market_id]
        if (market) {
          market.selections.push(selection)
        }
      }
    }

    cache.set(cache_key, markets_data, 900)
    res.send(markets_data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /markets/games/{esbid}:
 *   get:
 *     tags:
 *       - Markets
 *     summary: Get betting markets for a specific NFL game
 *     description: |
 *       Retrieve all betting markets available for a specific NFL game, including
 *       player props, team props, and game-level markets. This endpoint consolidates
 *       all betting opportunities for a single game from the specified sportsbook.
 *     parameters:
 *       - name: esbid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-zA-Z0-9-]+$'
 *         description: ESPN game ID (format YYYYMMDDII where II is game instance)
 *         example: "2025012601"
 *       - name: bookmaker
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/BookmakerEnum'
 *           default: FANDUEL
 *         description: Sportsbook to retrieve markets from
 *         example: DRAFTKINGS
 *       - name: time_type
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/TimeTypeEnum'
 *           default: CLOSE
 *         description: Market time type (when odds were captured)
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of markets to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of markets to skip (for pagination)
 *     responses:
 *       200:
 *         description: Game markets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/BettingMarket'
 *                   - type: object
 *                     properties:
 *                       esbid:
 *                         type: string
 *                         description: ESPN game ID
 *                         example: "2025012601"
 *                       source_market_id:
 *                         type: string
 *                         description: Unique market identifier from sportsbook
 *                         example: "dk_123456789"
 *                       time_type:
 *                         $ref: '#/components/schemas/TimeTypeEnum'
 *                       selection_pid:
 *                         type: string
 *                         nullable: true
 *                         description: Player ID if this is a player prop market
 *                         example: "PATR-MAHO-2017-1995-09-17"
 *             examples:
 *               game_markets_mix:
 *                 summary: Mixed game and player markets
 *                 value:
 *                   - market_type: "GAME_PASSING_YARDS"
 *                     source_id: "DRAFTKINGS"
 *                     source_market_name: "Patrick Mahomes - Passing Yards"
 *                     esbid: "2025012601"
 *                     open: true
 *                     live: false
 *                     settled: false
 *                     selection_pid: "PATR-MAHO-2017-1995-09-17"
 *                     selections:
 *                       - selection_name: "Over"
 *                         selection_type: "OVER"
 *                         selection_metric_line: 267.5
 *                         odds_decimal: 1.909
 *                         odds_american: -110
 *                   - market_type: "GAME_TOTAL_POINTS"
 *                     source_id: "DRAFTKINGS"
 *                     source_market_name: "Total Points"
 *                     esbid: "2025012601"
 *                     open: true
 *                     live: false
 *                     settled: false
 *                     selection_pid: null
 *                     selections:
 *                       - selection_name: "Over"
 *                         selection_type: "OVER"
 *                         selection_metric_line: 47.5
 *                         odds_decimal: 1.909
 *                         odds_american: -110
 *                       - selection_name: "Under"
 *                         selection_type: "UNDER"
 *                         selection_metric_line: 47.5
 *                         odds_decimal: 1.909
 *                         odds_american: -110
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         description: Game not found or no markets available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "missing game ID parameter"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/games/:esbid', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { esbid } = req.params
    const params = {
      bookmaker: req.query.bookmaker || 'FANDUEL',
      time_type: req.query.time_type || 'CLOSE',
      limit: Number(req.query.limit) || 1000,
      offset: Number(req.query.offset) || 0
    }

    if (!esbid) {
      return res.status(400).send({ error: 'missing game ID parameter' })
    }

    const cache_key = `/markets/games/${esbid}/${params.bookmaker}/${params.time_type}/${params.limit}/${params.offset}`
    const cached_data = cache.get(cache_key)
    if (cached_data) {
      return res.send(cached_data)
    }

    const markets_data = await db('prop_markets_index')
      .select('prop_markets_index.*')
      .where('prop_markets_index.esbid', esbid)
      .where('prop_markets_index.source_id', params.bookmaker)
      .where('prop_markets_index.time_type', params.time_type)
      .limit(params.limit)
      .offset(params.offset)

    // Get selections for each market
    const source_market_ids = markets_data.map((m) => m.source_market_id)
    if (source_market_ids.length > 0) {
      const selections_data = await db('prop_market_selections_index')
        .select('prop_market_selections_index.*')
        .whereIn(
          'prop_market_selections_index.source_market_id',
          source_market_ids
        )

      const markets_index = {}
      for (const market of markets_data) {
        market.selections = []
        markets_index[market.source_market_id] = market
      }

      for (const selection of selections_data) {
        const market = markets_index[selection.source_market_id]
        if (market) {
          market.selections.push(selection)
        }
      }
    }

    cache.set(cache_key, markets_data, 900)
    res.send(markets_data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /markets/{source_market_id}:
 *   get:
 *     tags:
 *       - Markets
 *     summary: Get detailed information for a specific betting market
 *     description: |
 *       Retrieve comprehensive information for a single betting market, including
 *       all available selections, current odds, and optionally historical data.
 *       This endpoint provides the most detailed view of a specific market.
 *     parameters:
 *       - name: source_market_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the betting market from the sportsbook
 *         example: "dk_123456789"
 *       - name: include_history
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include historical selection data instead of current index data
 *         example: true
 *     responses:
 *       200:
 *         description: Market details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BettingMarket'
 *                 - type: object
 *                   properties:
 *                     source_market_id:
 *                       type: string
 *                       description: Unique market identifier from sportsbook
 *                       example: "dk_123456789"
 *                     time_type:
 *                       $ref: '#/components/schemas/TimeTypeEnum'
 *                     selection_pid:
 *                       type: string
 *                       nullable: true
 *                       description: Player ID if this is a player prop market
 *                       example: "PATR-MAHO-2017-1995-09-17"
 *                     selections:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/BettingMarketSelection'
 *                           - type: object
 *                             properties:
 *                               source_market_id:
 *                                 type: string
 *                                 description: Market identifier this selection belongs to
 *                                 example: "dk_123456789"
 *                               timestamp:
 *                                 type: string
 *                                 format: date-time
 *                                 description: When this selection data was recorded
 *                                 example: "2024-01-15T14:30:00Z"
 *                       description: All betting selections for this market
 *             examples:
 *               passing_yards_market:
 *                 summary: Passing yards prop market
 *                 value:
 *                   market_type: "GAME_PASSING_YARDS"
 *                   source_id: "DRAFTKINGS"
 *                   source_market_name: "Patrick Mahomes - Passing Yards"
 *                   source_market_id: "dk_123456789"
 *                   esbid: "2025012601"
 *                   open: true
 *                   live: false
 *                   settled: false
 *                   selection_pid: "PATR-MAHO-2017-1995-09-17"
 *                   selections:
 *                     - selection_name: "Over"
 *                       selection_type: "OVER"
 *                       selection_metric_line: 267.5
 *                       odds_decimal: 1.909
 *                       odds_american: -110
 *                       source_market_id: "dk_123456789"
 *                       timestamp: "2024-01-15T14:30:00Z"
 *                       current_season_hit_rate_hard: 0.652
 *                       current_season_edge_hard: 0.045
 *                     - selection_name: "Under"
 *                       selection_type: "UNDER"
 *                       selection_metric_line: 267.5
 *                       odds_decimal: 1.909
 *                       odds_american: -110
 *                       source_market_id: "dk_123456789"
 *                       timestamp: "2024-01-15T14:30:00Z"
 *                       current_season_hit_rate_hard: 0.348
 *                       current_season_edge_hard: -0.045
 *               team_total_market:
 *                 summary: Team total points market
 *                 value:
 *                   market_type: "GAME_TEAM_TOTAL_POINTS"
 *                   source_id: "FANDUEL"
 *                   source_market_name: "Kansas City Chiefs - Total Points"
 *                   source_market_id: "fd_987654321"
 *                   esbid: "2025012601"
 *                   open: true
 *                   live: false
 *                   settled: false
 *                   selection_pid: null
 *                   selections:
 *                     - selection_name: "Over"
 *                       selection_type: "OVER"
 *                       selection_metric_line: 23.5
 *                       odds_decimal: 1.833
 *                       odds_american: -120
 *                       source_market_id: "fd_987654321"
 *                       timestamp: "2024-01-15T14:30:00Z"
 *                     - selection_name: "Under"
 *                       selection_type: "UNDER"
 *                       selection_metric_line: 23.5
 *                       odds_decimal: 2.100
 *                       odds_american: 110
 *                       source_market_id: "fd_987654321"
 *                       timestamp: "2024-01-15T14:30:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         description: Market not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "market not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:source_market_id', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { source_market_id } = req.params
    const include_history = req.query.include_history === 'true'

    if (!source_market_id) {
      return res
        .status(400)
        .send({ error: 'missing source_market_id parameter' })
    }

    const cache_key = `/markets/single/${source_market_id}/${include_history}`
    const cached_data = cache.get(cache_key)
    if (cached_data) {
      return res.send(cached_data)
    }

    // Get market data
    const market_data = await db('prop_markets_index')
      .select('prop_markets_index.*')
      .where('prop_markets_index.source_market_id', source_market_id)
      .first()

    if (!market_data) {
      return res.status(404).send({ error: 'market not found' })
    }

    // Get selections - always include them for single market requests
    const selections_table = include_history
      ? 'prop_market_selections_history'
      : 'prop_market_selections_index'
    const selections_data = await db(selections_table)
      .select(`${selections_table}.*`)
      .where(`${selections_table}.source_market_id`, source_market_id)
      .orderBy(`${selections_table}.timestamp`, 'desc')

    market_data.selections = selections_data

    cache.set(cache_key, market_data, 900)
    res.send(market_data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
