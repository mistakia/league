import express from 'express'

import { constants } from '#libs-shared'
import { validators } from '#libs-server'
import cache from '#api/cache.mjs'

const router = express.Router()

router.get('/props', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const week = Number(req.query.week) || constants.season.week
    if (validators.week_validator({ week }) !== true) {
      return res.status(400).send({ error: 'invalid week' })
    }

    const year = Number(req.query.year) || constants.season.year
    if (validators.year_validator({ year }) !== true) {
      return res.status(400).send({ error: 'invalid year' })
    }

    const seas_type = req.query.seas_type || constants.season.nfl_seas_type
    if (validators.seas_type_validator({ seas_type }) !== true) {
      return res.status(400).send({ error: 'invalid seas_type' })
    }

    const cacheKey = `/odds/props/REG/${year}/${week}`

    const odds = cache.get(cacheKey)
    if (odds) {
      return res.send(odds)
    }

    const data = await db('props_index')
      .select(
        'player.lname as player_last_name',
        'player.fname as player_first_name',
        'player.formatted as player_formatted_name',
        'player.pos as player_position',

        'player.esbid as player_esbid',
        'player.gsisid as player_gsisid',
        'player.gsispid as player_gsispid',
        'player.gsisItId as player_gsis_it_id',
        'player.sleeper_id as player_sleeper_id',
        'player.rotoworld_id as player_rotoworld_id',
        'player.rotowire_id as player_rotowire_id',
        'player.sportradar_id as player_sportradar_id',
        'player.espn_id as player_espn_id',
        'player.fantasy_data_id as player_fantasy_data_id',
        'player.yahoo_id as player_yahoo_id',
        'player.pfr_id as player_pfr_id',

        'props_index.prop_type',
        'props_index.ln as line',
        'props_index.o as over_decimal',
        'props_index.u as under_decimal',
        'props_index.o_am as over_american',
        'props_index.u_am as under_american',
        'props_index.source_id as prop_source',
        'props_index.time_type',
        'props_index.timestamp',

        'nfl_games.year',
        'nfl_games.week',
        'nfl_games.day',
        'nfl_games.seas_type',
        'nfl_games.week_type',

        'nfl_games.esbid as game_esbid',
        'nfl_games.gsisid as game_gsisid'
        // 'nfl_games.espnid',
        // 'nfl_games.pfrid',
      )
      .join('nfl_games', 'props_index.esbid', 'nfl_games.esbid')
      .join('player', 'props_index.pid', 'player.pid')
      .where('nfl_games.seas_type', seas_type)
      .where('nfl_games.year', year)
      .where('nfl_games.week', week)

    const props = data.map((row) => ({
      ...row,

      prop_source: constants.source_keys[row.prop_source]
    }))

    cache.set(cacheKey, props, 300) // 5 mins

    res.send(props)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
