import fetch from 'node-fetch'
// import debug from 'debug'

import config from '#config'
import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'

// const log = debug('prizepicks')
// debug.enable('prizepicks')

export const stats = {
  // 'Pass+Rush+Rec TDs':
  'Pass Yards': player_prop_types.GAME_PASSING_YARDS,
  'Rush Yards': player_prop_types.GAME_RUSHING_YARDS,
  'Receiving Yards': player_prop_types.GAME_RECEIVING_YARDS,
  'Pass Completions': player_prop_types.GAME_PASSING_COMPLETIONS,
  'Pass Attempts': player_prop_types.GAME_PASSING_ATTEMPTS,
  // 'Pass+Rush Yds':
  // 'Kicking Points':
  // 'Punts':
  // 'FG Made':
  'Tackles+Ast': player_prop_types.GAME_TACKLES_ASSISTS,
  'Rush+Rec Yds': player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
  Receptions: player_prop_types.GAME_RECEPTIONS
}

export const getPlayerProps = async ({ page = 1 }) => {
  const url = `${config.prizepicks_api_url}/projections?league_id=9&per_page=250&single_stat=true&page=${page}`

  // log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  return data
}
