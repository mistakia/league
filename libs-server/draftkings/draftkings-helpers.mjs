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

  return !(
    has_division_pattern ||
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
    log(`Skipping invalid team name: ${team_name}`)
    return null
  }

  try {
    return fixTeam(team_name)
  } catch (err) {
    log(`Error processing team name "${team_name}": ${err.message}`)
    log(`Stack trace: ${err.stack}`)
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
