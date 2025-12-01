import { player_game_alt_prop_types } from '#libs-shared/bookmaker-constants.mjs'
import { normalize_selection_metric_line } from '../normalize-selection-metric-line.mjs'

/**
 * Market types that use YES/NO selection types (player achieves milestone or not)
 * These markets don't typically have explicit YES/NO in the selection name
 */
const YES_NO_MARKET_TYPES = new Set([
  'ANYTIME_TOUCHDOWN',
  'GAME_TWO_PLUS_TOUCHDOWNS',
  'GAME_FIRST_TOUCHDOWN_SCORER',
  'GAME_FIRST_TEAM_TOUCHDOWN_SCORER'
])

/**
 * Checks if a market type uses YES/NO selection types
 * @param {string} market_type - The market type
 * @returns {boolean} - Whether the market type uses YES/NO selections
 */
export const is_yes_no_market_type = (market_type) => {
  return YES_NO_MARKET_TYPES.has(market_type)
}

const format_selection_player_name = (str = '') => {
  str = str.split(' - ')[0].replace('Over', '').replace('Under', '')
  str = str.split('(')[0] // remove anything in paranthesis
  return str.trim()
}

// Extract player name from FanDuel event market description
export const extract_player_name_from_event_market_description = (
  eventMarketDescription
) => {
  return eventMarketDescription.split(' - ')[0]
}

const format_market_name_player_name = (str = '') => {
  // Check if the string contains a date or "Regular Season"
  if (str.match(/\d{4}-\d{2}/) || str.includes('Regular Season')) {
    // Match the player name at the start of the string
    const match = str.match(
      /^((?:[A-Z]\.?'?){1,2}\s?(?:[A-Za-z]+[-'.]?\w*\s?){1,3}(?:Jr\.)?)(?=\s(?:\d{4}-\d{2}|Regular Season))/
    )

    // If a match is found, return it trimmed, otherwise return an empty string
    return match ? match[1].trim() : ''
  }

  if (str.includes('-')) {
    str = str.split(' - ')[0]
    return str.trim()
  }

  return ''
}

const market_name_market_types = [
  'REGULAR_SEASON_PROPS_-_QUARTERBACKS',
  'QUARTERBACK_REGULAR_SEASON_PROPS',
  'REGULAR_SEASON_PROPS_-_WIDE_RECEIVERS',
  'WIDE_RECEIVER_REGULAR_SEASON_PROPS',
  'REGULAR_SEASON_PROPS_-_RUNNING_BACKS',
  'RUNNING_BACK_REGULAR_SEASON_PROPS'
]

export const format_selection_type = ({ market_type, selection_name }) => {
  if (!selection_name) {
    return null
  }

  const player_alt_game_market_types = Object.values(player_game_alt_prop_types)
  if (
    market_type &&
    player_alt_game_market_types.includes(market_type) &&
    selection_name.includes('+')
  ) {
    return 'OVER'
  }

  const words = selection_name.toLowerCase().split(/\s+/)

  // Check for explicit keywords first
  if (words.includes('over')) {
    return 'OVER'
  } else if (words.includes('under')) {
    return 'UNDER'
  } else if (words.includes('yes')) {
    return 'YES'
  } else if (words.includes('no')) {
    return 'NO'
  }

  // For YES/NO market types, determine selection type from selection name pattern
  // These markets have selections like "Player Name" (YES) or "No Player Name" (NO)
  if (market_type && is_yes_no_market_type(market_type)) {
    const lower_name = selection_name.toLowerCase()
    // Check if selection name starts with "no " (indicating NO selection)
    if (lower_name.startsWith('no ')) {
      return 'NO'
    }
    // Default to YES for these market types (betting player will achieve milestone)
    return 'YES'
  }

  return null
}

export const get_player_string = ({ marketName, marketType, runnerName }) => {
  let use_market_name = false

  if (marketType.startsWith('PLAYER_')) {
    use_market_name = true
  }

  if (market_name_market_types.includes(marketType)) {
    use_market_name = true
  }

  if (use_market_name) {
    return format_market_name_player_name(marketName)
  }

  return format_selection_player_name(runnerName)
}

export const get_selection_metric_from_selection_name = (selection_name) => {
  const metric_line = selection_name.match(/(\d+(?:\.5+)?)\+?/)
  if (metric_line) {
    const raw_line = Number(metric_line[1])
    // Normalize the line for N+ discrete stat markets
    return normalize_selection_metric_line({
      raw_value: raw_line,
      selection_name
    })
  }

  return null
}
