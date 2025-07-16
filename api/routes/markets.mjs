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
  values: ['OPEN', 'CLOSE', 'LIVE'],
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
  seas_type: { type: 'string', optional: true, enum: ['PRE', 'REG', 'POST'] },
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

// GET /markets/:source_market_id/history - Historical data for a specific market
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

// GET /markets/players/:pid - Markets for specific player
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

// GET /markets/games/:esbid - Markets for specific game
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

// GET /markets/:source_market_id - Single market with all selections
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
