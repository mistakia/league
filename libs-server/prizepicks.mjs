import fetch from 'node-fetch'
import debug from 'debug'

import config from '#config'
import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'

const log = debug('prizepicks')
// debug.enable('prizepicks')

export const get_market_type = (stat_type) => {
  if (!stat_type) return null

  switch (stat_type) {
    case 'Rush Yards':
      // case 'Rush Yards (Combo)':
      return player_prop_types.GAME_RUSHING_YARDS

    // case 'Rush Yards in First 5 Attempts':

    case 'Receptions':
      return player_prop_types.GAME_RECEPTIONS

    case 'Pass Completions':
      return player_prop_types.GAME_PASSING_COMPLETIONS

    // case 'Completions in First 10 Pass Attempts':

    case 'Pass Yards':
      // case 'Pass Yards (Combo)':
      return player_prop_types.GAME_PASSING_YARDS

    case 'Receiving Yards':
      // case 'Receiving Yards (Combo)':
      return player_prop_types.GAME_RECEIVING_YARDS

    // case 'Receiving Yards in First 2 Receptions':

    case 'Pass Attempts':
      return player_prop_types.GAME_PASSING_ATTEMPTS

    case 'Rush+Rec Yds':
      // case 'Rush+Rec Yds (Combo)':
      return player_prop_types.GAME_RUSHING_RECEIVING_YARDS

    case 'Tackles+Ast':
      return player_prop_types.GAME_TACKLES_ASSISTS

    case 'Longest Rush':
      return player_prop_types.GAME_LONGEST_RUSH

    case 'Longest Reception':
      return player_prop_types.GAME_LONGEST_RECEPTION

    case 'Pass TDs':
      return player_prop_types.GAME_PASSING_TOUCHDOWNS

    case 'Rush TDs':
      return player_prop_types.GAME_RUSHING_TOUCHDOWNS

    case 'Rec TDs':
      return player_prop_types.GAME_RECEIVING_TOUCHDOWNS

    case 'INT':
      // case 'INT (Combo)':
      return player_prop_types.GAME_PASSING_INTERCEPTIONS

    case 'Rush Attempts':
      return player_prop_types.GAME_RUSHING_ATTEMPTS

    case 'Pass Deflections':
      return player_prop_types.GAME_PASS_DEFLECTIONS

    case 'Pass+Rush+Rec TDs':
      return player_prop_types.GAME_PASSING_RUSHING_RECEIVING_TOUCHDOWNS

    case 'Rush+Rec TDs':
      return player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS

    case 'Sacks':
      return player_prop_types.GAME_DEFENSE_SACKS

    case 'Tackles for Loss':
      return player_prop_types.GAME_TACKLES_FOR_LOSS

    case 'Pass+Rush Yds':
      return player_prop_types.GAME_PASSING_RUSHING_YARDS

    case 'Punts':
      return player_prop_types.GAME_PUNTS

    case 'Rec Targets':
      return player_prop_types.GAME_RECEIVING_TARGETS

    case 'FG Made':
      return player_prop_types.GAME_FIELD_GOALS_MADE

    case 'Completion Percentage':
      return player_prop_types.GAME_PASSING_COMPLETION_PERCENTAGE

    case 'Fantasy Score':
      return player_prop_types.GAME_PPR_FANTASY_POINTS

    default:
      log(`Unhandled stat type: ${stat_type}`)
      return null
  }
}

export const getPlayerProps = async ({ page = 1 }) => {
  const url = `${config.prizepicks_api_url}/projections?league_id=9&per_page=250&single_stat=true&page=${page}`

  // log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  return data
}
