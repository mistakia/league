import express from 'express'
import Validator from 'fastest-validator'

import { constants, bookmaker_constants } from '#libs-shared'
import cache from '#api/cache.mjs'
import { validators } from '#libs-server'

const router = express.Router()
const v = new Validator({ haltOnFirstError: true })

const bookmaker_schema = {
  type: 'enum',
  values: Object.values(bookmaker_constants.bookmakers),
  $$root: true
}

const bookmaker_validator = v.compile(bookmaker_schema)

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const week =
      Number(req.query.week) || Number(constants.season.nfl_seas_week)
    const year = Number(req.query.year) || Number(constants.season.year)
    const seas_type = req.query.seas_type || constants.season.nfl_seas_type
    const bookmaker = req.query.bookmaker || 'FANDUEL'

    const week_validation_result = validators.week_validator(week)
    if (week_validation_result !== true) {
      return res.status(400).send({
        error: `invalid week query param: ${week_validation_result[0].message}`
      })
    }

    const year_validation_result = validators.year_validator(year)
    if (year_validation_result !== true) {
      return res.status(400).send({
        error: `invalid year query param: ${year_validation_result[0].message}`
      })
    }

    const seas_type_validation_result =
      validators.seas_type_validator(seas_type)
    if (seas_type_validation_result !== true) {
      return res.status(400).send({
        error: `invalid seas_type query param: ${seas_type_validation_result[0].message}`
      })
    }

    const bookmaker_validation_result = bookmaker_validator(bookmaker)
    if (bookmaker_validation_result !== true) {
      return res.status(400).send({
        error: `invalid bookmaker query param: ${bookmaker_validation_result[0].message}`
      })
    }

    const cache_key = `/markets/${year}/${week}/${seas_type}/${bookmaker}`
    const markets = cache.get(cache_key)
    if (markets) {
      return res.send(markets)
    }

    const markets_data = await db('prop_markets_index')
      .select('prop_markets_index.*')
      .leftJoin('nfl_games', 'prop_markets_index.esbid', 'nfl_games.esbid')
      .where('nfl_games.week', week)
      .where('nfl_games.year', year)
      .where('nfl_games.seas_type', seas_type)
      .where('prop_markets_index.source_id', bookmaker)
      .where('prop_markets_index.time_type', 'CLOSE')

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
      markets_index[market.source_market_id] = market
    }

    for (const selection of selections_data) {
      const market = markets_index[selection.source_market_id]
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
