import debug from 'debug'

import {
  player_prop_types,
  team_game_market_types,
  game_props_types,
  futures_types,
  team_season_types,
  division_specials_types,
  team_props_types
} from './bookmaker-constants.mjs'

import {
  valid_selection_types,
  valid_season_types,
  valid_day_values
} from './constants/selection-constants.mjs'

import { nfl_team_abbreviations } from './constants/nfl-teams-constants.mjs'

const log = debug('format-standard-selection-id')

// All valid market types from bookmaker-constants.mjs
const all_market_types = {
  ...player_prop_types,
  ...team_game_market_types,
  ...game_props_types,
  ...futures_types,
  ...team_season_types,
  ...division_specials_types,
  ...team_props_types
}

// Create Set for O(1) team validation lookup
const valid_teams_set = new Set(nfl_team_abbreviations)

/**
 * Validates that a value does not contain reserved characters
 * @param {string} value - The value to validate
 * @param {string} field_name - The name of the field for error messages
 */
const validate_no_reserved_chars = (value, field_name) => {
  if (typeof value !== 'string') {
    return
  }
  if (value.includes('|') || value.includes(':')) {
    throw new Error(
      `${field_name} cannot contain reserved characters '|' or ':': ${value}`
    )
  }
}

/**
 * Builds UNKNOWN format selection ID from parameters
 * @private
 */
const build_unknown_format = ({
  source_id,
  esbid,
  year,
  seas_type,
  week,
  day,
  market_type,
  pid,
  team,
  selection_type,
  line,
  raw_data = {}
}) => {
  const raw_parts = []

  if (esbid) raw_parts.push(`esbid=${esbid}`)
  if (year) raw_parts.push(`year=${year}`)
  if (seas_type) raw_parts.push(`seas_type=${seas_type}`)
  if (week) raw_parts.push(`week=${week}`)
  if (day) raw_parts.push(`day=${day}`)
  if (market_type) raw_parts.push(`market_type=${market_type}`)
  if (pid) raw_parts.push(`pid=${pid}`)
  if (team) raw_parts.push(`team=${team}`)
  if (selection_type) raw_parts.push(`sel=${selection_type}`)
  if (line !== undefined && line !== null) raw_parts.push(`line=${line}`)

  for (const [key, value] of Object.entries(raw_data)) {
    if (value !== undefined && value !== null) {
      raw_parts.push(`${key}=${value}`)
    }
  }

  return `UNKNOWN|SOURCE:${source_id}|RAW:${raw_parts.join(',')}`
}

/**
 * Formats a standard selection ID using key-value pair structure
 *
 * Format: {event_identifier}|MARKET:{market_type}|{subject}|SEL:{selection_type}|LINE:{line}
 *
 * Event types:
 * - Game: ESBID:{esbid}
 * - Season: SEAS:{year}|SEAS_TYPE:{seas_type}
 * - Week: SEAS:{year}|SEAS_TYPE:{seas_type}|WEEK:{week}
 * - Day: SEAS:{year}|SEAS_TYPE:{seas_type}|WEEK:{week}|DAY:{day}
 *
 * @param {Object} params
 * @param {string} [params.esbid] - Event Sports Business ID for game events
 * @param {number} [params.year] - Season year for non-game events
 * @param {string} [params.seas_type] - Season type: REG, POST, PRE
 * @param {number} [params.week] - Week number for week/day events
 * @param {string} [params.day] - Day value for day events (SUN, SN, MN, etc.)
 * @param {string} params.market_type - Market type from bookmaker-constants.mjs
 * @param {string} [params.pid] - Player ID for player props
 * @param {string} [params.team] - Team code for team props
 * @param {string} [params.selection_type] - OVER, UNDER, YES, NO
 * @param {number|string} [params.line] - Numeric line value (signed for spreads)
 * @param {boolean} [params.safe] - If true, return UNKNOWN format instead of throwing on errors
 * @param {string} [params.source_id] - Book identifier for UNKNOWN format (required if safe=true)
 * @param {Object} [params.raw_data] - Additional raw data to include in UNKNOWN format
 * @returns {string} Formatted selection ID, or UNKNOWN format if safe=true and validation fails
 * @throws {Error} If validation fails and safe is not true
 */
const format_standard_selection_id = ({
  esbid,
  year,
  seas_type,
  week,
  day,
  market_type,
  pid,
  team,
  selection_type: sel_type,
  line,
  safe = false,
  source_id,
  raw_data
}) => {
  const build_unknown = (error_msg) => {
    log(`Selection ID formatting failed: ${error_msg}`)
    return build_unknown_format({
      source_id: source_id || 'UNKNOWN',
      esbid,
      year,
      seas_type,
      week,
      day,
      market_type,
      pid,
      team,
      selection_type: sel_type,
      line,
      raw_data
    })
  }

  try {
    // Validate market_type is required and valid
    if (!market_type) {
      throw new Error('market_type is required')
    }
    if (!all_market_types[market_type]) {
      throw new Error(`Invalid market_type: ${market_type}`)
    }

    // Validate event identifier consistency (esbid XOR year)
    const has_esbid = esbid !== undefined && esbid !== null
    const has_year = year !== undefined && year !== null

    if (!has_esbid && !has_year) {
      throw new Error('Either esbid or year must be provided')
    }

    if (has_esbid && has_year) {
      throw new Error('Cannot provide both esbid and year')
    }

    // Validate selection_type if provided
    if (sel_type && !valid_selection_types.includes(sel_type)) {
      throw new Error(
        `Invalid selection_type: ${sel_type}. Must be one of: ${valid_selection_types.join(', ')}`
      )
    }

    // Validate seas_type if provided
    if (seas_type && !valid_season_types.includes(seas_type)) {
      throw new Error(
        `Invalid seas_type: ${seas_type}. Must be one of: ${valid_season_types.join(', ')}`
      )
    }

    // Validate day if provided
    if (day && !valid_day_values.includes(day)) {
      throw new Error(
        `Invalid day: ${day}. Must be one of: ${valid_day_values.join(', ')}`
      )
    }

    // Validate team abbreviation if provided
    if (team && !valid_teams_set.has(team)) {
      throw new Error(
        `Invalid team abbreviation: ${team}. Must be one of: ${nfl_team_abbreviations.join(', ')}`
      )
    }

    // Validate no reserved characters in values
    validate_no_reserved_chars(esbid, 'esbid')
    validate_no_reserved_chars(pid, 'pid')
    validate_no_reserved_chars(team, 'team')

    // Build the selection ID
    const parts = []

    // Event identifier (first key(s))
    if (has_esbid) {
      parts.push(`ESBID:${esbid}`)
    } else {
      parts.push(`SEAS:${year}`)

      if (seas_type) {
        parts.push(`SEAS_TYPE:${seas_type}`)
      }

      if (week !== undefined && week !== null) {
        parts.push(`WEEK:${week}`)
      }

      if (day) {
        parts.push(`DAY:${day}`)
      }
    }

    // Market type (always required)
    parts.push(`MARKET:${market_type}`)

    // Subject identifier (PID or TEAM)
    if (pid) {
      parts.push(`PID:${pid}`)
    }

    if (team) {
      parts.push(`TEAM:${team}`)
    }

    // Selection type (OVER, UNDER, YES, NO)
    if (sel_type) {
      parts.push(`SEL:${sel_type}`)
    }

    // Line value
    if (line !== undefined && line !== null) {
      parts.push(`LINE:${line}`)
    }

    return parts.join('|')
  } catch (err) {
    if (safe) {
      return build_unknown(err.message)
    }
    throw err
  }
}

export default format_standard_selection_id
