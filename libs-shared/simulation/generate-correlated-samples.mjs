/**
 * Correlated sampling module for fantasy football simulation.
 * Generates correlated uniform random samples via Cholesky decomposition.
 */

import jstat from 'jstat'
import { CholeskyDecomposition, Matrix } from 'ml-matrix'

/**
 * Standard normal CDF (cumulative distribution function).
 * Transforms a standard normal value to uniform [0,1].
 *
 * @param {number} value - Standard normal value
 * @returns {number} Uniform value in [0,1]
 */
export function normal_cdf(value) {
  return jstat.normal.cdf(value, 0, 1)
}

/**
 * Generate a pair of independent standard normal values using Box-Muller transform.
 *
 * @param {Function} random - Random function returning values in [0,1)
 * @returns {[number, number]} Pair of independent standard normal values
 */
function box_muller_pair(random) {
  const u1 = random()
  const u2 = random()
  const r = Math.sqrt(-2 * Math.log(u1))
  const theta = 2 * Math.PI * u2
  return [r * Math.cos(theta), r * Math.sin(theta)]
}

/**
 * Generate an array of n standard normal values using Box-Muller transform.
 *
 * @param {number} n - Number of values to generate
 * @param {Function} random - Random function returning values in [0,1)
 * @returns {number[]} Array of standard normal values
 */
function generate_normals_array(n, random) {
  const result = []
  for (let i = 0; i < n; i += 2) {
    const [z1, z2] = box_muller_pair(random)
    result.push(z1)
    if (i + 1 < n) {
      result.push(z2)
    }
  }
  return result
}

/**
 * Generate standard normal random values.
 * Uses Box-Muller transform for generating pairs of independent normals.
 *
 * @param {Object} params
 * @param {number} params.n_simulations - Number of simulations
 * @param {number} params.n_players - Number of players
 * @param {number} [params.seed] - Optional seed for reproducibility
 * @returns {number[][]} Matrix of standard normal values [n_simulations x n_players]
 */
export function generate_standard_normals({ n_simulations, n_players, seed }) {
  const random = seed !== undefined ? seeded_random(seed) : Math.random
  const result = []

  for (let sim = 0; sim < n_simulations; sim++) {
    result.push(generate_normals_array(n_players, random))
  }

  return result
}

/**
 * Simple seeded PRNG (mulberry32).
 *
 * @param {number} seed - Seed value
 * @returns {Function} Random function that returns values in [0,1)
 */
function seeded_random(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Perform Cholesky decomposition on a correlation matrix.
 *
 * @param {Object} params
 * @param {number[][]} params.correlation_matrix - Symmetric positive-definite correlation matrix
 * @returns {Object} { lower_matrix, is_positive_definite }
 */
export function cholesky_decomposition({ correlation_matrix }) {
  const matrix = new Matrix(correlation_matrix)
  const cholesky = new CholeskyDecomposition(matrix)

  return {
    lower_matrix: cholesky.lowerTriangularMatrix.to2DArray(),
    is_positive_definite: cholesky.isPositiveDefinite()
  }
}

/**
 * Generate correlated uniform random samples.
 * Uses Cholesky decomposition to transform independent normals to correlated normals,
 * then transforms to uniforms via the normal CDF.
 *
 * @param {Object} params
 * @param {number[][]} params.correlation_matrix - Correlation matrix (already positive-definite)
 * @param {number} params.n_simulations - Number of simulations to run
 * @param {number} [params.seed] - Optional seed for reproducibility
 * @returns {number[][]} Matrix of correlated uniform values [n_simulations x n_players]
 */
export function generate_correlated_uniforms({
  correlation_matrix,
  n_simulations,
  seed
}) {
  const n_players = correlation_matrix.length

  // Get Cholesky decomposition (L such that LL' = correlation_matrix)
  const { lower_matrix, is_positive_definite } = cholesky_decomposition({
    correlation_matrix
  })

  // Validate precondition for direct callers (no extra cost - flag computed during decomposition)
  if (!is_positive_definite) {
    throw new Error(
      'Correlation matrix is not positive definite. Use ensure_positive_definite() first.'
    )
  }

  // Generate independent standard normal samples
  const independent_normals = generate_standard_normals({
    n_simulations,
    n_players,
    seed
  })

  // Transform to correlated normals: Z_correlated = L * Z_independent
  const correlated_uniforms = []

  for (let sim = 0; sim < n_simulations; sim++) {
    const z_independent = independent_normals[sim]
    const z_correlated = []

    // Matrix multiplication: L * z
    for (let i = 0; i < n_players; i++) {
      let sum = 0
      for (let j = 0; j <= i; j++) {
        // Lower triangular, so only j <= i
        sum += lower_matrix[i][j] * z_independent[j]
      }
      z_correlated.push(sum)
    }

    // Transform correlated normals to uniforms via CDF
    const uniforms = z_correlated.map((z) => normal_cdf(z))
    correlated_uniforms.push(uniforms)
  }

  return correlated_uniforms
}

/**
 * Generate correlated samples for a single simulation.
 * Useful when running simulations one at a time.
 *
 * @param {Object} params
 * @param {number[][]} params.lower_matrix - Pre-computed Cholesky lower matrix
 * @param {number} params.n_players - Number of players
 * @param {Function} [params.random] - Random function, defaults to Math.random
 * @returns {number[]} Array of correlated uniform values for one simulation
 */
export function generate_single_correlated_sample({
  lower_matrix,
  n_players,
  random = Math.random
}) {
  // Generate independent standard normals
  const z_independent = generate_normals_array(n_players, random)

  // Transform to correlated normals: z_correlated = L * z_independent
  const z_correlated = []
  for (let i = 0; i < n_players; i++) {
    let sum = 0
    for (let j = 0; j <= i; j++) {
      sum += lower_matrix[i][j] * z_independent[j]
    }
    z_correlated.push(sum)
  }

  // Transform to uniforms
  return z_correlated.map((z) => normal_cdf(z))
}
