import debug from 'debug'

import db from '#db'
import * as cache from './cache.mjs'
import { constants, bookmaker_constants } from '#libs-shared'
import { fetch_with_retry } from './proxy-manager.mjs'

const log = debug('pinnacle')

const get_pinnacle_config = async () => {
  const config_row = await db('config').where('key', 'pinnacle_config').first()
  return config_row.value
}

export const format_selection_type = (selection_name) => {
  if (!selection_name) {
    return null
  }

  const words = selection_name.toLowerCase().split(/\s+/)

  if (words.includes('over')) {
    return 'OVER'
  } else if (words.includes('under')) {
    return 'UNDER'
  } else if (words.includes('yes')) {
    return 'YES'
  } else if (words.includes('no')) {
    return 'NO'
  }

  return null
}

export const get_market_type_for_matchup = ({
  pinnacle_odds_type,
  is_alternate_pinnacle_market
}) => {
  switch (pinnacle_odds_type.toLowerCase()) {
    case 'spread':
      return is_alternate_pinnacle_market
        ? bookmaker_constants.team_game_market_types.GAME_ALT_SPREAD
        : bookmaker_constants.team_game_market_types.GAME_SPREAD
    case 'total':
      return is_alternate_pinnacle_market
        ? bookmaker_constants.team_game_market_types.GAME_ALT_TOTAL
        : bookmaker_constants.team_game_market_types.GAME_TOTAL
    case 'moneyline':
      return bookmaker_constants.team_game_market_types.GAME_MONEYLINE
    case 'team_total':
      return is_alternate_pinnacle_market
        ? bookmaker_constants.team_game_market_types.GAME_ALT_TEAM_TOTAL
        : bookmaker_constants.team_game_market_types.GAME_TEAM_TOTAL
    default:
      log(`unknown game market type: ${pinnacle_odds_type} for matchup`)
      return null
  }
}

export const get_market_type_for_special = ({
  pinnacle_special_category,
  pinnacle_special_description,
  pinnacle_odds_type,
  pinnacle_matchup_units,
  is_alternate_pinnacle_market
}) => {
  switch (pinnacle_special_category) {
    case 'To Make Playoffs':
      if (
        pinnacle_odds_type === 'moneyline' &&
        pinnacle_matchup_units === 'Regular'
      ) {
        return bookmaker_constants.team_season_types.TEAM_TO_MAKE_PLAYOFFS
      }
      break

    case 'Regular Season Wins':
      if (pinnacle_odds_type === 'total' && pinnacle_matchup_units === 'Wins') {
        return bookmaker_constants.team_season_types.TEAM_REGULAR_SEASON_WINS
      }
      break

    case 'Futures':
      if (
        pinnacle_odds_type === 'moneyline' &&
        pinnacle_matchup_units === 'Place 1st'
      ) {
        if (pinnacle_special_description?.includes('Super Bowl')) {
          return bookmaker_constants.futures_types.SUPER_BOWL_WINNER
        } else if (pinnacle_special_description?.includes('AFC Winner')) {
          return bookmaker_constants.futures_types.CONFERENCE_WINNER
        } else if (pinnacle_special_description?.includes('NFC Winner')) {
          return bookmaker_constants.futures_types.CONFERENCE_WINNER
        } else if (
          pinnacle_special_description?.includes('East Winner') ||
          pinnacle_special_description?.includes('West Winner') ||
          pinnacle_special_description?.includes('North Winner') ||
          pinnacle_special_description?.includes('South Winner')
        ) {
          return bookmaker_constants.futures_types.DIVISION_WINNER
        }
      }
      break

    case 'NFL Most Valuable Player':
      if (
        pinnacle_odds_type === 'moneyline' &&
        pinnacle_matchup_units === 'Regular'
      ) {
        return bookmaker_constants.awards_prop_types.SEASON_MVP
      }
      break

    case 'NFL Defensive Player of the Year':
      if (
        pinnacle_odds_type === 'moneyline' &&
        pinnacle_matchup_units === 'Regular'
      ) {
        return bookmaker_constants.awards_prop_types
          .DEFENSIVE_PLAYER_OF_THE_YEAR
      }
      break

    case 'NFL Offensive Player of the Year':
      if (
        pinnacle_odds_type === 'moneyline' &&
        pinnacle_matchup_units === 'Regular'
      ) {
        return bookmaker_constants.awards_prop_types
          .OFFENSIVE_PLAYER_OF_THE_YEAR
      }
      break

    case 'NFL Offensive Rookie of the Year':
      if (
        pinnacle_odds_type === 'moneyline' &&
        pinnacle_matchup_units === 'Regular'
      ) {
        return bookmaker_constants.awards_prop_types
          .OFFENSIVE_ROOKIE_OF_THE_YEAR
      }
      break

    case 'NFL Defensive Rookie of the Year':
      if (
        pinnacle_odds_type === 'moneyline' &&
        pinnacle_matchup_units === 'Regular'
      ) {
        return bookmaker_constants.awards_prop_types
          .DEFENSIVE_ROOKIE_OF_THE_YEAR
      }
      break

    case 'NFL Coach of the Year':
      if (
        pinnacle_odds_type === 'moneyline' &&
        pinnacle_matchup_units === 'Regular'
      ) {
        return bookmaker_constants.awards_prop_types.COACH_OF_THE_YEAR
      }
      break

    case 'NFL Protector of the Year':
      if (
        pinnacle_odds_type === 'moneyline' &&
        pinnacle_matchup_units === 'Place 1st'
      ) {
        return bookmaker_constants.awards_prop_types.PROTECTOR_OF_THE_YEAR
      }
      break

    default:
      log(`unmapped special category: ${pinnacle_special_category}`)
      break
  }

  // Log unmatched cases for known categories
  if (pinnacle_special_category) {
    log(
      `unmatched special category: ${pinnacle_special_category} / ${pinnacle_special_description} / ${pinnacle_odds_type} / ${pinnacle_matchup_units}`
    )
  }

  return null
}

export const get_market_type = ({
  is_alternate_pinnacle_market = false,
  pinnacle_matchup_type,
  pinnacle_special_description,
  pinnacle_special_category,
  pinnacle_odds_type,
  pinnacle_matchup_units
}) => {
  switch (pinnacle_matchup_type) {
    case 'matchup':
      return get_market_type_for_matchup({
        pinnacle_odds_type,
        is_alternate_pinnacle_market
      })
    case 'special':
      return get_market_type_for_special({
        pinnacle_special_category,
        pinnacle_special_description,
        pinnacle_odds_type,
        pinnacle_matchup_units,
        is_alternate_pinnacle_market
      })
    default:
      log(`unknown market type: ${pinnacle_matchup_type}`)
      return null
  }
}

export const get_nfl_matchups = async ({ ignore_cache = false } = {}) => {
  const cache_key = `/pinnacle/nfl_matchups/${constants.season.year}/${constants.season.week}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log('cache hit for nfl matchups')
      return cache_value
    }
  }

  const pinnacle_config = await get_pinnacle_config()

  const url = `${pinnacle_config.api_url}/leagues/889/matchups`
  log(`fetching ${url}`)

  const response = await fetch_with_retry(
    url,
    {
      headers: pinnacle_config.headers
    },
    {
      max_retries: 3,
      use_proxy: true,
      exponential_backoff: true
    }
  )

  const data = await response.json()

  if (data) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const get_market_odds = async ({
  matchup_id,
  ignore_cache = false
} = {}) => {
  if (!matchup_id) {
    throw new Error('matchup_id is required')
  }

  const cache_key = `/pinnacle/market_odds/${matchup_id}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for market odds with matchup_id: ${matchup_id}`)
      return cache_value
    }
  }

  const pinnacle_config = await get_pinnacle_config()

  const url = `${pinnacle_config.api_url}/matchups/${matchup_id}/markets/related/straight`
  log(`fetching ${url}`)

  const response = await fetch_with_retry(
    url,
    {
      headers: pinnacle_config.headers
    },
    {
      max_retries: 3,
      use_proxy: true,
      exponential_backoff: true
    }
  )

  const data = await response.json()

  if (data) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
