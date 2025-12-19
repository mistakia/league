/**
 * Utility functions for fantasy football simulation.
 * Pure helper functions for common operations.
 */

import { mean, standardDeviation, median, quantile } from 'simple-statistics'

/**
 * Find winners from team scores (handles ties).
 * Returns team IDs with the highest score, splitting credit for ties.
 *
 * @param {Object} params
 * @param {Map|Object} params.team_scores - Map or object of team_id -> score
 * @returns {Object} { winners: team_id[], max_score: number, win_credit: number }
 */
export function find_winners({ team_scores }) {
  let max_score = -Infinity
  const winners = []

  // Handle both Map and plain object
  const entries =
    team_scores instanceof Map
      ? team_scores.entries()
      : Object.entries(team_scores)

  for (const [team_id, score] of entries) {
    if (score > max_score) {
      max_score = score
      winners.length = 0
      winners.push(team_id)
    } else if (score === max_score) {
      winners.push(team_id)
    }
  }

  return {
    winners,
    max_score,
    win_credit: 1 / winners.length
  }
}

/**
 * Distribute win credit to winners.
 * Mutates the team_wins map by adding win_credit to each winner.
 *
 * @param {Object} params
 * @param {Map} params.team_wins - Map of team_id -> win count (mutated)
 * @param {string[]|number[]} params.winners - Array of winning team IDs
 * @param {number} params.win_credit - Credit to add per winner (typically 1/winners.length)
 */
export function distribute_win_credit({ team_wins, winners, win_credit }) {
  for (const team_id of winners) {
    team_wins.set(team_id, (team_wins.get(team_id) || 0) + win_credit)
  }
}

/**
 * Calculate distribution statistics from an array of scores.
 * Unified function that handles both team and player distributions.
 *
 * @param {number[]} scores - Array of scores
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.include_percentiles=true] - Include median and percentiles
 * @param {boolean} [options.is_locked=false] - Whether this is a locked (actual) score
 * @returns {Object} Distribution statistics
 */
export function calculate_distribution(scores, options = {}) {
  const { include_percentiles = true, is_locked = false } = options

  if (!scores || scores.length === 0) {
    const base = { mean: 0, std: 0, min: 0, max: 0 }
    if (include_percentiles) {
      return { ...base, median: 0, percentile_25: 0, percentile_75: 0 }
    }
    return { ...base, is_locked }
  }

  const base = {
    mean: mean(scores),
    std: standardDeviation(scores),
    min: Math.min(...scores),
    max: Math.max(...scores)
  }

  if (include_percentiles) {
    return {
      ...base,
      median: median(scores),
      percentile_25: quantile(scores, 0.25),
      percentile_75: quantile(scores, 0.75)
    }
  }

  return { ...base, is_locked }
}

/**
 * Create a constant distribution for a fixed value (locked/actual scores).
 *
 * @param {number} value - The constant value
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.include_percentiles=false] - Include percentile fields
 * @returns {Object} Distribution with zero variance
 */
export function create_constant_distribution(value, options = {}) {
  const { include_percentiles = false } = options

  const base = { mean: value, std: 0, min: value, max: value }

  if (include_percentiles) {
    return {
      ...base,
      median: value,
      percentile_25: value,
      percentile_75: value
    }
  }

  return { ...base, is_locked: true }
}

// Backward-compatible wrappers for existing code

/**
 * Calculate score distribution statistics (team-level with percentiles).
 * @deprecated Use calculate_distribution() with include_percentiles=true
 */
export function calculate_score_distribution(scores) {
  return calculate_distribution(scores, { include_percentiles: true })
}

/**
 * Calculate player score distribution (without percentiles).
 * @deprecated Use calculate_distribution() with include_percentiles=false
 */
export function calculate_player_distribution(scores, is_locked = false) {
  return calculate_distribution(scores, {
    include_percentiles: false,
    is_locked
  })
}

/**
 * Create a constant distribution for locked (actual) scores.
 * @deprecated Use create_constant_distribution()
 */
export function create_locked_distribution(actual_points) {
  return create_constant_distribution(actual_points, {
    include_percentiles: false
  })
}

/**
 * Create a constant team score distribution for locked results.
 * @deprecated Use create_constant_distribution() with include_percentiles=true
 */
export function create_locked_team_distribution(total) {
  return create_constant_distribution(total, { include_percentiles: true })
}
