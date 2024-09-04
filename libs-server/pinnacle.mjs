import { fetch as fetch_http2 } from 'fetch-h2'
import debug from 'debug'

import db from '#db'
import * as cache from './cache.mjs'
import { constants, bookmaker_constants } from '#libs-shared'

const log = debug('pinnacle')

const get_pinnacle_config = async () => {
  const config_row = await db('config').where('key', 'pinnacle_config').first()
  return config_row.value
}

export const get_market_type = ({ type, units, category }) => {
  switch (category) {
    case 'Game Lines':
      switch (type) {
        case 'Spread':
          return bookmaker_constants.game_market_types.GAME_SPREAD
        case 'Total':
          return bookmaker_constants.game_market_types.GAME_TOTAL
        case 'Moneyline':
          return bookmaker_constants.game_market_types.GAME_MONEYLINE
        default:
          log(`unknown game market type: ${type} for Game Lines`)
          return null
      }

    case 'Player Props':
      switch (units) {
        case 'RushingYards':
          return bookmaker_constants.player_game_prop_types.GAME_RUSHING_YARDS
        case 'Touchdowns':
          return bookmaker_constants.player_game_prop_types
            .GAME_RUSHING_RECEIVING_TOUCHDOWNS
        case 'TouchdownPasses':
          return bookmaker_constants.player_game_prop_types
            .GAME_PASSING_TOUCHDOWNS
        case 'ReceivingYards':
          return bookmaker_constants.player_game_prop_types.GAME_RECEIVING_YARDS
        case 'PassReceptions':
          return bookmaker_constants.player_game_prop_types.GAME_RECEPTIONS
        case 'LongestPassComplete':
          return bookmaker_constants.player_game_prop_types
            .GAME_PASSING_LONGEST_COMPLETION
        case 'PassingYards':
          return bookmaker_constants.player_game_prop_types.GAME_PASSING_YARDS
        case 'LongestReception':
          return bookmaker_constants.player_game_prop_types
            .GAME_LONGEST_RECEPTION
        case 'KickingPoints':
          return null // Not standardized, return null or create a new constant if needed
        case 'Completions':
          return bookmaker_constants.player_game_prop_types
            .GAME_PASSING_COMPLETIONS
        case 'PassAttempts':
          return bookmaker_constants.player_game_prop_types
            .GAME_PASSING_ATTEMPTS
        case 'Interceptions':
          return bookmaker_constants.player_game_prop_types
            .GAME_PASSING_INTERCEPTIONS
        case '1st Touchdown':
          return bookmaker_constants.player_game_prop_types
            .GAME_FIRST_TOUCHDOWN_SCORER
        case 'Last Touchdown':
          return bookmaker_constants.player_game_prop_types
            .GAME_LAST_TOUCHDOWN_SCORER
        default:
          log(`unknown player prop type: ${units} for Player Props`)
          return null
      }

    case 'Regular Season Wins':
      return 'SEASON_WINS'
    case 'NFL Offensive Rookie of the Year':
      return 'NFL_OFFENSIVE_ROOKIE_OF_THE_YEAR'
    case 'NFL Comeback Player of the Year':
      return 'NFL_COMEBACK_PLAYER_OF_THE_YEAR'
    case 'NFL Coach of the Year':
      return 'NFL_COACH_OF_THE_YEAR'
    case 'NFL Defensive Player of the Year':
      return 'NFL_DEFENSIVE_PLAYER_OF_THE_YEAR'
    case 'NFL Most Valuable Player':
      return 'NFL_MOST_VALUABLE_PLAYER'
    case 'NFL Defensive Rookie of the Year':
      return 'NFL_DEFENSIVE_ROOKIE_OF_THE_YEAR'
    case 'NFL Offensive Player of the Year':
      return 'NFL_OFFENSIVE_PLAYER_OF_THE_YEAR'

    default:
      log(`unknown market type: ${category} / ${type} / ${units}`)
      return null
  }
}

export const get_nfl_markets = async ({ ignore_cache = false } = {}) => {
  const cache_key = `/pinnacle/nfl_markets/${constants.season.year}/${constants.season.week}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log('cache hit for nfl markets')
      return cache_value
    }
  }

  const pinnacle_config = await get_pinnacle_config()

  const url = `${pinnacle_config.api_url}/leagues/889/matchups`
  log(`fetching ${url}`)

  const response = await fetch_http2(url, {
    headers: pinnacle_config.headers
  })

  const data = await response.json()

  if (data) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const get_market_odds = async ({
  market_parent_id,
  ignore_cache = false
} = {}) => {
  if (!market_parent_id) {
    throw new Error('market_parent_id is required')
  }

  const cache_key = `/pinnacle/market_odds/${market_parent_id}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(
        `cache hit for market odds with market_parent_id: ${market_parent_id}`
      )
      return cache_value
    }
  }

  const pinnacle_config = await get_pinnacle_config()

  const url = `${pinnacle_config.api_url}/matchups/${market_parent_id}/markets/related/straight`
  log(`fetching ${url}`)

  const response = await fetch_http2(url, {
    headers: pinnacle_config.headers
  })

  const data = await response.json()

  if (data) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
