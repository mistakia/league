/**
 * Player relationship detector for fantasy football simulation.
 * Determines relationships between players from pre-loaded schedule data (pure function).
 */

// Relationship type constants
export const RELATIONSHIP_TYPES = {
  SAME_TEAM: 'same_team',
  CROSS_TEAM_SAME_GAME: 'cross_team_same_game',
  INDEPENDENT: 'independent'
}

/**
 * Get the relationship between two players based on NFL schedule.
 *
 * @param {Object} params
 * @param {Object} params.player_a - First player { pid, nfl_team }
 * @param {Object} params.player_b - Second player { pid, nfl_team }
 * @param {Object} params.schedule - Pre-loaded schedule from libs-server
 *   Format: { [team_abbrev]: { opponent, esbid, is_home } }
 * @returns {string|null} Relationship type or null if either player's team is on bye
 */
export function get_player_relationship({ player_a, player_b, schedule }) {
  const team_a = player_a.nfl_team
  const team_b = player_b.nfl_team

  // Check if either team is on bye (not in schedule)
  const game_a = schedule[team_a]
  const game_b = schedule[team_b]

  if (!game_a || !game_b) {
    // At least one player's team is on bye
    return null
  }

  // Same NFL team = teammates
  if (team_a === team_b) {
    return RELATIONSHIP_TYPES.SAME_TEAM
  }

  // Check if playing in the same NFL game (opponents)
  if (game_a.opponent === team_b) {
    // Verify the relationship is reciprocal (sanity check)
    if (game_b.opponent === team_a) {
      return RELATIONSHIP_TYPES.CROSS_TEAM_SAME_GAME
    }
  }

  // Different NFL games = independent (correlation = 0)
  return RELATIONSHIP_TYPES.INDEPENDENT
}

/**
 * Get list of teams on bye for a given week.
 *
 * @param {Object} params
 * @param {Object} params.schedule - Pre-loaded schedule from libs-server
 * @param {string[]} params.all_nfl_teams - Array of all 32 NFL team abbreviations
 * @returns {string[]} Array of team abbreviations on bye
 */
export function get_teams_on_bye({ schedule, all_nfl_teams }) {
  return all_nfl_teams.filter((team) => !schedule[team])
}

/**
 * Check if a player's team is on bye.
 *
 * @param {Object} params
 * @param {string} params.nfl_team - NFL team abbreviation
 * @param {Object} params.schedule - Pre-loaded schedule
 * @returns {boolean} True if team is on bye
 */
export function is_team_on_bye({ nfl_team, schedule }) {
  return !schedule[nfl_team]
}

/**
 * Get all unique NFL games from a list of players.
 * Useful for understanding how many games a fantasy matchup spans.
 *
 * @param {Object} params
 * @param {Object[]} params.players - Array of players with { pid, nfl_team }
 * @param {Object} params.schedule - Pre-loaded schedule
 * @returns {Set<number>} Set of unique esbid values
 */
export function get_unique_nfl_games({ players, schedule }) {
  const game_ids = new Set()

  for (const player of players) {
    const game = schedule[player.nfl_team]
    if (game && game.esbid) {
      game_ids.add(game.esbid)
    }
  }

  return game_ids
}

/**
 * Group players by their NFL game.
 * Players on bye are excluded.
 *
 * @param {Object} params
 * @param {Object[]} params.players - Array of players with { pid, nfl_team, ... }
 * @param {Object} params.schedule - Pre-loaded schedule
 * @returns {Map<number, Object[]>} Map of esbid -> players in that game
 */
export function group_players_by_nfl_game({ players, schedule }) {
  const games_map = new Map()

  for (const player of players) {
    const game = schedule[player.nfl_team]
    if (game && game.esbid) {
      if (!games_map.has(game.esbid)) {
        games_map.set(game.esbid, [])
      }
      games_map.get(game.esbid).push(player)
    }
  }

  return games_map
}

/**
 * Determine if two players have a same-team relationship that may be affected
 * by a mid-season team change.
 *
 * @param {Object} params
 * @param {string} params.current_team_a - Current NFL team of player A
 * @param {string} params.current_team_b - Current NFL team of player B
 * @param {string} params.correlation_team_a - Team A was on when correlation was calculated
 * @param {string} params.correlation_team_b - Team B was on when correlation was calculated
 * @returns {boolean} True if correlation may be stale due to team change
 */
export function is_correlation_stale_due_to_team_change({
  current_team_a,
  current_team_b,
  correlation_team_a,
  correlation_team_b
}) {
  // Check if either player changed teams since correlation was calculated
  const player_a_changed = current_team_a !== correlation_team_a
  const player_b_changed = current_team_b !== correlation_team_b

  // If it was a same-team correlation and either player changed teams,
  // the correlation is no longer valid
  if (correlation_team_a === correlation_team_b) {
    // Was same team when calculated
    if (player_a_changed || player_b_changed) {
      return true
    }
  }

  return false
}
