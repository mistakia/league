import {
  player_game_alt_prop_types,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'
import { normalize_selection_metric_line } from '../normalize-selection-metric-line.mjs'

/**
 * Market types that use YES/NO selection types (player achieves milestone or not)
 * These markets don't typically have explicit YES/NO in the selection name
 */
const YES_NO_MARKET_TYPES = new Set([
  'ANYTIME_TOUCHDOWN',
  'GAME_TWO_PLUS_TOUCHDOWNS',
  'GAME_FIRST_TOUCHDOWN_SCORER',
  'GAME_FIRST_TEAM_TOUCHDOWN_SCORER',
  'GAME_LAST_TOUCHDOWN_SCORER'
])

/**
 * Implicit thresholds for market types where the threshold is determined by
 * market type rather than provided in the data.
 *
 * Values are normalized (N-0.5) to work with strict inequality (>) comparison:
 * - 0.5 means 1+ (> 0.5 equals >= 1)
 * - 1.5 means 2+ (> 1.5 equals >= 2)
 */
const IMPLICIT_THRESHOLD_MARKET_TYPES = {
  ANYTIME_TOUCHDOWN: 0.5, // Player scores 1+ TDs
  GAME_TWO_PLUS_TOUCHDOWNS: 1.5, // Player scores 2+ TDs
  GAME_FIRST_TOUCHDOWN_SCORER: 0.5, // Player scores first TD (1+ in context)
  GAME_LAST_TOUCHDOWN_SCORER: 0.5, // Player scores last TD (1+ in context)
  GAME_FIRST_TEAM_TOUCHDOWN_SCORER: 0.5 // Player scores first team TD (1+ in context)
}

/**
 * Returns the implicit threshold for a market type that doesn't have an explicit
 * handicap/line value in the data.
 *
 * @param {string} market_type - The market type
 * @returns {number|null} - The implicit threshold (normalized) or null if not applicable
 */
export const get_implicit_threshold_for_market_type = (market_type) => {
  if (!market_type) {
    return null
  }
  return IMPLICIT_THRESHOLD_MARKET_TYPES[market_type] ?? null
}

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

  // ALT markets with N+ format (e.g., "250+ Yards") are OVER selections
  const player_alt_game_market_types = Object.values(player_game_alt_prop_types)
  const is_alt_market_with_plus =
    market_type &&
    selection_name.includes('+') &&
    (player_alt_game_market_types.includes(market_type) ||
      TEAM_ALT_YARDAGE_MARKET_TYPES.has(market_type))

  if (is_alt_market_with_plus) {
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

/**
 * Team spread market types that use team name + spread format
 */
const TEAM_SPREAD_MARKET_TYPES = new Set([
  team_game_market_types.GAME_ALT_SPREAD,
  team_game_market_types.GAME_SPREAD
])

/**
 * Team ALT yardage market types that use N+ format (e.g., "250+ Yards" means OVER)
 * These markets don't have explicit OVER/UNDER in selection name
 */
const TEAM_ALT_YARDAGE_MARKET_TYPES = new Set([
  team_game_market_types.GAME_TEAM_ALT_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_ALT_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_ALT_RECEIVING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_ALT_RECEIVING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_ALT_RECEIVING_YARDS
])

/**
 * Team yardage market types that require team resolution from market type
 * Includes both standard O/U markets and ALT markets
 */
const TEAM_YARDAGE_MARKET_TYPES = new Set([
  team_game_market_types.GAME_TEAM_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_RECEIVING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_TOTAL_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_HALF_RECEIVING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_RUSHING_YARDS,
  team_game_market_types.GAME_TEAM_FIRST_QUARTER_RECEIVING_YARDS,
  // Include all ALT types
  ...TEAM_ALT_YARDAGE_MARKET_TYPES
])

/**
 * Checks if a market type is a team spread market
 * @param {string} market_type - The market type
 * @returns {boolean} - Whether the market type is a team spread market
 */
export const is_team_spread_market = (market_type) => {
  return TEAM_SPREAD_MARKET_TYPES.has(market_type)
}

/**
 * Parses a team spread selection name to extract team name and spread line
 * Format: "Team Name (+/-X.X)" e.g. "Miami Dolphins (+23.5)" or "New York Jets (-3.5)"
 * @param {string} selection_name - The selection name from FanDuel
 * @returns {object|null} - { team_name, spread_line, selection_type } or null if not a valid spread format
 */
export const parse_team_spread_selection = (selection_name) => {
  // Match pattern: "Team Name (+ or - number)" with optional .5
  const match = selection_name.match(/^(.+?)\s*\(([+-])(\d+(?:\.\d+)?)\)$/)
  if (!match) {
    return null
  }

  const team_name = match[1].trim()
  const sign = match[2]
  const spread_value = parseFloat(match[3])

  // Convert to spread line (positive value for underdogs, negative for favorites)
  const spread_line = sign === '+' ? spread_value : -spread_value

  return {
    team_name,
    spread_line,
    // For spreads, use the team name as the selection type identifier
    selection_type: team_name
  }
}

/**
 * Checks if a market type is a team yardage market
 * @param {string} market_type - The normalized market type
 * @returns {boolean} - Whether the market type is a team yardage market
 */
export const is_team_yardage_market = (market_type) => {
  return TEAM_YARDAGE_MARKET_TYPES.has(market_type)
}

/**
 * Parses a FanDuel source market type to extract HOME/AWAY designation
 * FanDuel market types for team yardage use format: (HOME|AWAY)_...
 * @param {string} source_market_type - The FanDuel marketType field
 * @returns {string|null} - 'HOME' or 'AWAY', or null if not a team yardage format
 */
export const parse_team_yardage_source_market_type = (source_market_type) => {
  if (!source_market_type) {
    return null
  }

  if (source_market_type.startsWith('HOME_')) {
    return 'HOME'
  }

  if (source_market_type.startsWith('AWAY_')) {
    return 'AWAY'
  }

  return null
}
