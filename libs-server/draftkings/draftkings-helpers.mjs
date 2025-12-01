/**
 * Helper functions for DraftKings odds import and processing
 */

import debug from 'debug'
import { fixTeam } from '#libs-shared'
import { CONFIG } from './draftkings-constants.mjs'

const log = debug('import-draft-kings')

/**
 * Validates team names before passing to fixTeam
 * @param {string} team_name - The team name to validate
 * @returns {boolean} - Whether the team name is valid
 */
export const is_valid_team_name = (team_name) => {
  if (!team_name || typeof team_name !== 'string') {
    return false
  }

  const trimmed_name = team_name.trim()

  // Check for complex strings that shouldn't be passed to fixTeam
  const has_division_pattern = CONFIG.TEAM_VALIDATION.DIVISION_PATTERNS.some(
    (pattern) => pattern.test(trimmed_name)
  )

  // Check for futures market labels that aren't team names
  const has_non_team_pattern = CONFIG.TEAM_VALIDATION.NON_TEAM_PATTERNS.some(
    (pattern) => pattern.test(trimmed_name)
  )

  return !(
    has_division_pattern ||
    has_non_team_pattern ||
    trimmed_name.includes('/') ||
    trimmed_name.length > CONFIG.TEAM_VALIDATION.MAX_LENGTH
  )
}

/**
 * Safe wrapper around fixTeam that validates input
 * @param {string} team_name - The team name to fix
 * @returns {string|null} - Fixed team name or null if invalid
 */
export const safe_fix_team = (team_name) => {
  if (!is_valid_team_name(team_name)) {
    return null
  }

  try {
    return fixTeam(team_name)
  } catch (err) {
    // Silently handle errors - validation should have caught invalid inputs
    return null
  }
}

/**
 * Checks if an event is a game event vs futures/non-game event
 * @param {Object} draftkings_event - The DraftKings event object
 * @returns {boolean} - Whether this is a game event
 */
export const is_game_event = (draftkings_event) => {
  if (!draftkings_event) {
    return false
  }

  // Game events have numeric IDs, futures/non-game events have GUID format
  const is_numeric_id = CONFIG.EVENT_VALIDATION.NUMERIC_ID_PATTERN.test(
    draftkings_event.id
  )

  // Game events have 2 participants with venueRole (Home/Away)
  const has_two_participants =
    draftkings_event.participants?.length ===
    CONFIG.EVENT_VALIDATION.REQUIRED_PARTICIPANTS
  const has_venue_roles =
    draftkings_event.participants?.some(
      (p) => p.venueRole === CONFIG.EVENT_VALIDATION.VENUE_ROLES.HOME
    ) &&
    draftkings_event.participants?.some(
      (p) => p.venueRole === CONFIG.EVENT_VALIDATION.VENUE_ROLES.AWAY
    )

  // Game events have eventParticipantType of 'TwoTeam'
  const is_two_team_event = draftkings_event.eventParticipantType === 'TwoTeam'

  // Game events typically have event names with '@' (Team @ Team format)
  const has_game_name_format = draftkings_event.name?.includes(
    CONFIG.EVENT_VALIDATION.GAME_NAME_SEPARATOR
  )

  return (
    is_numeric_id &&
    has_two_participants &&
    (has_venue_roles || is_two_team_event || has_game_name_format)
  )
}

/**
 * Extracts team abbreviations from a DraftKings event
 * @param {Object} draftkings_event - The DraftKings event object
 * @param {boolean} is_game_event_result - Whether this is a game event
 * @returns {string[]} - Array of team abbreviations
 */
export const extract_team_abbreviations = (
  draftkings_event,
  is_game_event_result
) => {
  if (!is_game_event_result || !draftkings_event?.participants?.length >= 2) {
    return []
  }

  return [
    safe_fix_team(
      draftkings_event.participants[0]?.metadata?.shortName ||
        draftkings_event.participants[0]?.shortName ||
        draftkings_event.participants[0]?.name
    ),
    safe_fix_team(
      draftkings_event.participants[1]?.metadata?.shortName ||
        draftkings_event.participants[1]?.shortName ||
        draftkings_event.participants[1]?.name
    )
  ].filter(Boolean)
}

/**
 * Determines visitor and home teams from a DraftKings event
 * @param {Object} draftkings_event - The DraftKings event object
 * @returns {Object} - Object with visitor_team and home_team
 */
export const determine_teams = (draftkings_event) => {
  let visitor_team, home_team

  // Find home and away teams from participants
  const home_participant = draftkings_event.participants?.find(
    (p) => p.venueRole === CONFIG.EVENT_VALIDATION.VENUE_ROLES.HOME
  )
  const away_participant = draftkings_event.participants?.find(
    (p) => p.venueRole === CONFIG.EVENT_VALIDATION.VENUE_ROLES.AWAY
  )

  if (home_participant && away_participant) {
    visitor_team = safe_fix_team(
      away_participant.metadata?.shortName || away_participant.name
    )
    home_team = safe_fix_team(
      home_participant.metadata?.shortName || home_participant.name
    )
  } else if (
    draftkings_event.name?.includes(CONFIG.EVENT_VALIDATION.GAME_NAME_SEPARATOR)
  ) {
    // Primary fallback: parse event name "Visitor @ Home"
    const [visitor_name, home_name] = draftkings_event.name.split(
      CONFIG.EVENT_VALIDATION.GAME_NAME_SEPARATOR
    )
    visitor_team = safe_fix_team(visitor_name.split(' ').pop()) // Get last word (team name)
    home_team = safe_fix_team(home_name.split(' ').pop()) // Get last word (team name)
  } else {
    // Final fallback: use participants order
    visitor_team = safe_fix_team(
      draftkings_event.participants[0]?.metadata?.shortName ||
        draftkings_event.participants[0]?.shortName ||
        draftkings_event.participants[0]?.name
    )
    home_team = safe_fix_team(
      draftkings_event.participants[1]?.metadata?.shortName ||
        draftkings_event.participants[1]?.shortName ||
        draftkings_event.participants[1]?.name
    )
  }

  return { visitor_team, home_team }
}

/**
 * Extracts player name and team from a DraftKings player name
 * @param {string} draftkings_player_name - The player name from DraftKings
 * @returns {Object} - Object with cleaned name and team
 */
export const extract_player_info = (draftkings_player_name) => {
  if (!draftkings_player_name) {
    return { name: null, team: null }
  }

  const team_match = draftkings_player_name.match(
    CONFIG.PLAYER_PATTERNS.TEAM_ABBREVIATION
  )

  if (team_match) {
    const raw_team = team_match[1]
    const team = safe_fix_team(raw_team)
    const name = draftkings_player_name
      .replace(CONFIG.PLAYER_PATTERNS.TEAM_ABBREVIATION, '')
      .trim()

    return { name, team }
  }

  return { name: draftkings_player_name, team: null }
}

/**
 * Processes American odds, handling Unicode minus signs
 * @param {string|number} odds_value - The odds value to process
 * @returns {number|null} - Processed odds value or null
 */
export const process_american_odds = (odds_value) => {
  if (odds_value == null) {
    return null
  }

  // Handle Unicode minus sign if it's a string
  if (typeof odds_value === 'string') {
    odds_value = odds_value.replace(CONFIG.PLAYER_PATTERNS.UNICODE_MINUS, '-')
  }

  // Convert to number and round to integer
  return Math.round(Number(odds_value))
}

/**
 * Extracts metric line from selection label
 * @param {string} label - The selection label
 * @returns {number|null} - Extracted metric line or null
 */
export const extract_metric_line = (label) => {
  if (!label) return null

  const parsed_line = label.match(CONFIG.PLAYER_PATTERNS.METRIC_LINE)
  return parsed_line ? Number(parsed_line[0]) : null
}

/**
 * Extracts player name from NFL futures event name
 * @param {string} event_name - The event name
 * @returns {string|null} - Extracted player name or null
 */
export const extract_player_name_from_event = (event_name) => {
  if (!event_name || typeof event_name !== 'string') {
    return null
  }

  // Match pattern: "NFL 20XX/XX - Player Name"
  // Examples: "NFL 2025/26 - Kyler Murray", "NFL 2024/25 - Josh Allen"
  const nfl_futures_pattern = /^NFL\s+20\d{2}\/\d{2}\s+-\s+(.+)$/
  const match = event_name.match(nfl_futures_pattern)

  if (match && match[1]) {
    const player_name = match[1].trim()
    log(`Extracted player name from NFL futures event: ${player_name}`)
    return player_name
  }

  return null
}

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

/**
 * Formats selection type from selection name, optionally considering market type
 * @param {string} selection_name - The selection name
 * @param {string} [market_type] - Optional market type for context-aware parsing
 * @returns {string|null} - Formatted selection type (OVER, UNDER, YES, NO) or null
 */
export const format_selection_type = (selection_name, market_type = null) => {
  if (!selection_name) {
    return null
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
  } else if (/^\d+\+$/.test(selection_name)) {
    return 'OVER'
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

/**
 * Extracts team from participant data
 * @param {Object} params - The parameters
 * @param {string} params.participant - The participant name
 * @param {string} params.participantType - The participant type
 * @returns {string|null} - Team abbreviation or null
 */
export const get_team_from_participant = ({ participant, participantType }) => {
  if (participantType !== 'Team') {
    return null
  }

  if (!participant) {
    return null
  }

  // Use safe_fix_team which validates input and handles errors gracefully
  return safe_fix_team(participant)
}
