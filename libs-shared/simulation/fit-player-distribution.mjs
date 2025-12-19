/**
 * Distribution fitting module for fantasy football simulation.
 * Fits appropriate distributions based on player projection characteristics.
 */

import jstat from 'jstat'

import {
  CV_BOUNDS,
  ROOKIE_DEFAULT_CV,
  TRUNCATED_NORMAL_DEFAULTS
} from './correlation-constants.mjs'

// Distribution type constants
export const DISTRIBUTION_TYPES = {
  GAMMA: 'gamma',
  LOG_NORMAL: 'log_normal',
  TRUNCATED_NORMAL: 'truncated_normal',
  CONSTANT: 'constant'
}

/**
 * Select the appropriate distribution type based on player characteristics.
 *
 * @param {Object} params
 * @param {number} params.mean_points - Mean projected fantasy points
 * @param {number} params.std_points - Standard deviation of fantasy points
 * @returns {string} Distribution type from DISTRIBUTION_TYPES
 */
export function select_distribution({ mean_points, std_points }) {
  // Handle zero/no variance - deterministic outcome
  if (!std_points || std_points === 0) {
    return DISTRIBUTION_TYPES.CONSTANT
  }

  // Handle negative or zero mean - rarely used players
  if (mean_points <= 0) {
    return DISTRIBUTION_TYPES.TRUNCATED_NORMAL
  }

  const coefficient_of_variation = std_points / mean_points

  // Low-mean high-CV players - Log-normal is more stable than Gamma
  if (mean_points < 3 && coefficient_of_variation > 1) {
    return DISTRIBUTION_TYPES.LOG_NORMAL
  }

  // Standard case - Gamma distribution (right-skewed positive)
  return DISTRIBUTION_TYPES.GAMMA
}

/**
 * Constrain variance using position-specific CV bounds.
 *
 * @param {Object} params
 * @param {number} params.mean_points - Mean projected fantasy points
 * @param {number} params.std_points - Standard deviation of fantasy points
 * @param {string} params.position - Player position (QB, RB, WR, TE, K, DST)
 * @returns {number} Constrained standard deviation
 */
export function constrain_variance({ mean_points, std_points, position }) {
  if (mean_points <= 0) {
    return std_points
  }

  const coefficient_of_variation = std_points / mean_points
  const variance_bounds = CV_BOUNDS[position] || { min: 0.55, max: 2.5 }
  const constrained_cv = Math.max(
    variance_bounds.min,
    Math.min(variance_bounds.max, coefficient_of_variation)
  )

  return constrained_cv * mean_points
}

/**
 * Get default CV for a player without historical data (rookie).
 *
 * @param {Object} params
 * @param {string} params.position - Player position
 * @returns {number} Default CV value
 */
export function get_rookie_default_cv({ position }) {
  return ROOKIE_DEFAULT_CV[position] || 1.0
}

/**
 * Fit Gamma distribution parameters from mean and std.
 * Uses shape-scale parameterization (alpha, theta).
 *
 * @param {Object} params
 * @param {number} params.mean_points - Mean projected fantasy points
 * @param {number} params.std_points - Standard deviation of fantasy points
 * @returns {Object} { alpha (shape), theta (scale) }
 */
export function fit_gamma_params({ mean_points, std_points }) {
  const variance = std_points * std_points
  const alpha = (mean_points * mean_points) / variance // shape
  const theta = variance / mean_points // scale

  return { alpha, theta }
}

/**
 * Fit Log-normal distribution parameters from mean and std.
 *
 * @param {Object} params
 * @param {number} params.mean_points - Mean projected fantasy points
 * @param {number} params.std_points - Standard deviation of fantasy points
 * @returns {Object} { mu, sigma }
 */
export function fit_log_normal_params({ mean_points, std_points }) {
  const coefficient_of_variation = std_points / mean_points
  const sigma_squared = Math.log(
    1 + coefficient_of_variation * coefficient_of_variation
  )
  const mu = Math.log(mean_points) - sigma_squared / 2
  const sigma = Math.sqrt(sigma_squared)

  return { mu, sigma }
}

/**
 * Sample from a fitted distribution using a uniform random value.
 * Transforms uniform [0,1] to the target distribution via inverse CDF.
 *
 * @param {Object} params
 * @param {number} params.uniform_sample - Uniform random value in [0,1]
 * @param {string} params.distribution_type - Type from DISTRIBUTION_TYPES
 * @param {Object} params.distribution_params - Parameters for the distribution
 * @returns {number} Sampled fantasy points value
 */
export function sample_from_distribution({
  uniform_sample,
  distribution_type,
  distribution_params
}) {
  switch (distribution_type) {
    case DISTRIBUTION_TYPES.CONSTANT:
      return distribution_params.mean_points

    case DISTRIBUTION_TYPES.GAMMA: {
      const { alpha, theta } = distribution_params
      // jstat.gamma.inv uses shape-scale parameterization
      return jstat.gamma.inv(uniform_sample, alpha, theta)
    }

    case DISTRIBUTION_TYPES.LOG_NORMAL: {
      const { mu, sigma } = distribution_params
      // Transform uniform to standard normal, then to log-normal
      const z = jstat.normal.inv(uniform_sample, 0, 1)
      return Math.exp(mu + sigma * z)
    }

    case DISTRIBUTION_TYPES.TRUNCATED_NORMAL: {
      // For rarely-used players with negative or zero mean
      // Use a small positive mean with moderate variance, floored at 0
      const { mean, std } = TRUNCATED_NORMAL_DEFAULTS
      const sampled = jstat.normal.inv(uniform_sample, mean, std)
      return Math.max(0, sampled)
    }

    default:
      throw new Error(`Unknown distribution type: ${distribution_type}`)
  }
}

/**
 * Get complete distribution parameters for a player.
 * Handles all edge cases and returns ready-to-sample parameters.
 *
 * @param {Object} params
 * @param {number} params.projected_points - Mean projected fantasy points
 * @param {number} params.std_points - Standard deviation (from variance cache or default)
 * @param {string} params.position - Player position
 * @returns {Object} { distribution_type, distribution_params, projected_points, std_points }
 */
export function get_player_distribution_params({
  projected_points,
  std_points,
  position
}) {
  // Constrain variance to position-specific bounds
  const constrained_std = constrain_variance({
    mean_points: projected_points,
    std_points,
    position
  })

  // Select appropriate distribution
  const distribution_type = select_distribution({
    mean_points: projected_points,
    std_points: constrained_std
  })

  // Build distribution parameters
  let distribution_params

  switch (distribution_type) {
    case DISTRIBUTION_TYPES.CONSTANT:
      distribution_params = { mean_points: projected_points }
      break

    case DISTRIBUTION_TYPES.GAMMA:
      distribution_params = fit_gamma_params({
        mean_points: projected_points,
        std_points: constrained_std
      })
      break

    case DISTRIBUTION_TYPES.LOG_NORMAL:
      distribution_params = fit_log_normal_params({
        mean_points: projected_points,
        std_points: constrained_std
      })
      break

    case DISTRIBUTION_TYPES.TRUNCATED_NORMAL:
      distribution_params = {} // Uses fixed parameters in sample_from_distribution
      break

    default:
      distribution_params = { mean_points: projected_points }
  }

  return {
    distribution_type,
    distribution_params,
    projected_points,
    std_points: constrained_std
  }
}
