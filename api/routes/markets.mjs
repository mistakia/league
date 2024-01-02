import express from 'express'

import { constants } from '#libs-shared'
import cache from '#api/cache.mjs'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const week = Number(req.query.week) || constants.season.nfl_seas_week
    const year = Number(req.query.year) || constants.season.year
    const seas_type = req.query.seas_type || constants.season.nfl_seas_type

    const cacheKey = `/markets/${year}/${week}`
    const markets = cache.get(cacheKey)
    if (markets) {
      return res.send(markets)
    }

    const markets_data = await db('prop_markets_index_new')
      .select('prop_markets_index_new.*')
      .leftJoin('nfl_games', 'prop_markets_index_new.esbid', 'nfl_games.esbid')
      .where('nfl_games.week', week)
      .where('nfl_games.year', year)
      .where('nfl_games.seas_type', seas_type)

    const source_market_ids = markets_data.map(
      (market) => market.source_market_id
    )

    const selections_data = await db('prop_market_selections_history')
      .select('prop_market_selections_history.*')
      .whereIn(
        'prop_market_selections_history.source_market_id',
        source_market_ids
      )

    const markets_index = {}
    for (const market of markets_data) {
      market.selections = []
      markets_index[market.market_id] = market
    }

    for (const selection of selections_data) {
      const market = markets_index[selection.market_id]
      market.selections.push(selection)
    }

    const markets_array = Object.values(markets_index)
    // cache.set(cacheKey, markets_array, 900)

    res.send(markets_array)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
