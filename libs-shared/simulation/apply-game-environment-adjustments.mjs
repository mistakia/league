/**
 * Game environment adjustment functions for simulation.
 * Applies variance scaling and spread-based adjustments based on game totals and spreads.
 */

import debug from 'debug'

const log = debug('simulation:apply-game-environment-adjustments')

// Game environment constants
export const GAME_ENVIRONMENT_DEFAULTS = {
  BASELINE_GAME_TOTAL: 46,
  VARIANCE_SCALE_COEFFICIENT: 0.003, // Per point deviation from baseline
  MIN_VARIANCE_SCALE: 0.85,
  MAX_VARIANCE_SCALE: 1.15
}

// Position-specific spread adjustment coefficients
// Positive = favored team boost, Negative = underdog boost
export const SPREAD_ADJUSTMENT_COEFFICIENTS = {
  QB: 0.002, // Slight boost when favored
  RB: 0.005, // RBs benefit most when favored (more rushing)
  WR: -0.003, // WRs slightly benefit when trailing (more passing)
  TE: 0.0, // Neutral
  K: 0.003, // Kickers benefit from scoring opportunities
  DST: 0.004 // DST benefits when team is favored
}

/**
 * Calculate variance scale factor based on game total.
 * Higher totals = more variance, lower totals = less variance.
 *
 * @param {Object} params
 * @param {number} params.game_total - Expected game total from betting markets
 * @returns {number} Variance scale factor (centered around 1.0)
 */
export function calculate_variance_scale({ game_total }) {
  if (game_total === null || game_total === undefined) {
    return 1.0
  }

  const deviation = game_total - GAME_ENVIRONMENT_DEFAULTS.BASELINE_GAME_TOTAL
  const raw_scale =
    1.0 + deviation * GAME_ENVIRONMENT_DEFAULTS.VARIANCE_SCALE_COEFFICIENT

  // Clamp to reasonable bounds
  return Math.max(
    GAME_ENVIRONMENT_DEFAULTS.MIN_VARIANCE_SCALE,
    Math.min(GAME_ENVIRONMENT_DEFAULTS.MAX_VARIANCE_SCALE, raw_scale)
  )
}

/**
 * Calculate projection adjustment based on spread.
 *
 * @param {Object} params
 * @param {string} params.position - Player position
 * @param {number} params.team_spread - Team's spread (negative = favored)
 * @param {number} params.base_projection - Base projection before adjustment
 * @returns {number} Adjustment factor (1.0 = no change)
 */
export function calculate_spread_adjustment({
  position,
  team_spread,
  base_projection
}) {
  if (team_spread === null || team_spread === undefined) {
    return 1.0
  }

  const coefficient = SPREAD_ADJUSTMENT_COEFFICIENTS[position] || 0

  // Negative spread = favored, so negate for calculation
  // A -7 spread means team is 7 point favorite
  const adjustment = 1.0 + -team_spread * coefficient

  // Clamp to reasonable bounds (max 10% adjustment)
  return Math.max(0.9, Math.min(1.1, adjustment))
}

/**
 * Apply game environment adjustments to player projections and variance.
 *
 * @param {Object} params
 * @param {Object[]} params.players - Array of player objects with projection, variance, position, nfl_team, esbid
 * @param {Map} params.game_environment - Map of esbid -> { game_total, home_spread, away_spread, home_team, away_team }
 * @returns {Object[]} Players with adjusted projections and variance
 */
export function apply_game_environment_adjustments({
  players,
  game_environment
}) {
  if (!game_environment || game_environment.size === 0) {
    return players
  }

  log(`Applying game environment adjustments to ${players.length} players`)

  let adjustments_applied = 0

  const adjusted_players = players.map((player) => {
    const game_env = game_environment.get(player.esbid)

    if (!game_env) {
      return player
    }

    // Determine team spread
    let team_spread = null
    if (player.nfl_team === game_env.home_team) {
      team_spread = game_env.home_spread
    } else if (player.nfl_team === game_env.away_team) {
      team_spread = game_env.away_spread
    }

    // Calculate adjustments
    const variance_scale = calculate_variance_scale({
      game_total: game_env.game_total
    })

    const spread_factor = calculate_spread_adjustment({
      position: player.position,
      team_spread,
      base_projection: player.projection
    })

    // Apply adjustments
    const adjusted = { ...player }

    if (player.projection !== undefined) {
      adjusted.projection = player.projection * spread_factor
    }

    if (player.variance !== undefined) {
      adjusted.variance = player.variance * variance_scale
    }

    // Store adjustment metadata
    adjusted.game_environment = {
      game_total: game_env.game_total,
      team_spread,
      variance_scale,
      spread_factor
    }

    adjustments_applied++

    return adjusted
  })

  log(`Applied adjustments to ${adjustments_applied} players`)

  return adjusted_players
}

export default apply_game_environment_adjustments
