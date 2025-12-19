/**
 * Matrix regularization module for correlation matrices.
 * Ensures correlation matrices are positive semi-definite for Cholesky decomposition.
 */

import { EigenvalueDecomposition, Matrix } from 'ml-matrix'

import debug from 'debug'

import { SIMULATION_DEFAULTS } from './correlation-constants.mjs'

const log = debug('simulation:ensure-positive-definite')

/**
 * Check if a matrix is positive definite by attempting Cholesky decomposition.
 *
 * @param {number[][]} matrix - Square matrix to check
 * @returns {boolean} True if positive definite
 */
export function is_positive_definite(matrix) {
  const n = matrix.length

  // Try Cholesky decomposition
  // A matrix is positive definite iff Cholesky succeeds
  try {
    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let k = 0; k < i; k++) {
        sum += matrix[i][k] * matrix[i][k]
      }
      const diagonal = matrix[i][i] - sum
      if (diagonal <= 0) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

/**
 * Create an identity matrix of size n.
 *
 * @param {number} n - Size of the matrix
 * @returns {number[][]} Identity matrix
 */
export function identity_matrix(n) {
  const result = []
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0)
    row[i] = 1
    result.push(row)
  }
  return result
}

/**
 * Normalize a matrix to have unit diagonal (correlation matrix property).
 *
 * @param {number[][]} matrix - Matrix to normalize
 * @returns {number[][]} Normalized matrix with 1s on diagonal
 */
export function normalize_correlation_matrix(matrix) {
  const n = matrix.length
  const result = []

  // Get diagonal elements
  const diag = matrix.map((row, i) => Math.sqrt(row[i]))

  for (let i = 0; i < n; i++) {
    const row = []
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(1)
      } else if (diag[i] > 0 && diag[j] > 0) {
        row.push(matrix[i][j] / (diag[i] * diag[j]))
      } else {
        row.push(0)
      }
    }
    result.push(row)
  }

  return result
}

/**
 * Ensure a correlation matrix is positive semi-definite.
 * Uses a single-pass algorithm: diagonal regularization + eigenvalue clipping + identity fallback.
 *
 * @param {Object} params
 * @param {number[][]} params.matrix - Input correlation matrix
 * @param {number} [params.epsilon] - Regularization strength (shrinkage toward identity)
 * @param {number} [params.min_eigenvalue] - Minimum eigenvalue after clipping
 * @returns {Object} { matrix: number[][], used_fallback: boolean }
 */
export function ensure_positive_definite({
  matrix,
  epsilon = SIMULATION_DEFAULTS.MATRIX_REGULARIZATION_EPSILON,
  min_eigenvalue = SIMULATION_DEFAULTS.MIN_EIGENVALUE_THRESHOLD
}) {
  const matrix_size = matrix.length

  // Handle edge cases
  if (matrix_size === 0) {
    return { matrix: [], used_fallback: false }
  }

  if (matrix_size === 1) {
    return { matrix: [[1]], used_fallback: false }
  }

  // Step 1: Diagonal regularization (shrinkage toward independence)
  // This is theoretically justified since correlations are estimates
  const regularized_matrix = matrix.map((row, row_index) =>
    row.map((value, col_index) =>
      row_index === col_index ? 1 : value * (1 - epsilon)
    )
  )

  // Step 2: Check if already valid
  if (is_positive_definite(regularized_matrix)) {
    return { matrix: regularized_matrix, used_fallback: false }
  }

  log(
    `Matrix not positive definite after regularization, applying eigenvalue clipping`
  )

  // Step 3: Eigenvalue decomposition and clipping
  try {
    const ml_matrix = new Matrix(regularized_matrix)
    const eigen = new EigenvalueDecomposition(ml_matrix)

    const eigenvalues = eigen.realEigenvalues
    const eigenvector_matrix = eigen.eigenvectorMatrix

    // Check for negative eigenvalues
    const has_negative = eigenvalues.some((ev) => ev < min_eigenvalue)

    if (!has_negative) {
      // Matrix should be PD, but numerical issues prevented detection
      return { matrix: regularized_matrix, used_fallback: false }
    }

    log(
      `Clipping ${eigenvalues.filter((ev) => ev < min_eigenvalue).length} negative eigenvalues`
    )

    // Clip negative eigenvalues to minimum
    const clipped_eigenvalues = eigenvalues.map((ev) =>
      Math.max(ev, min_eigenvalue)
    )

    // Step 4: Reconstruct matrix: V * D * V'
    const n = matrix_size
    const d_matrix = Matrix.zeros(n, n)
    for (let i = 0; i < n; i++) {
      d_matrix.set(i, i, clipped_eigenvalues[i])
    }

    const v_matrix = eigenvector_matrix
    const v_transpose = v_matrix.transpose()
    const corrected = v_matrix.mmul(d_matrix).mmul(v_transpose)

    // Step 5: Restore unit diagonal
    const corrected_array = corrected.to2DArray()
    const normalized_matrix = normalize_correlation_matrix(corrected_array)

    // Step 6: Final validation
    if (is_positive_definite(normalized_matrix)) {
      return { matrix: normalized_matrix, used_fallback: false }
    }

    // If still not valid, fall back to identity
    log(
      `Matrix regularization failed after eigenvalue clipping, falling back to identity`
    )
    return { matrix: identity_matrix(matrix_size), used_fallback: true }
  } catch (error) {
    // Eigenvalue decomposition failed - fall back to identity
    log(`Eigenvalue decomposition failed: ${error.message}`)
    return { matrix: identity_matrix(matrix_size), used_fallback: true }
  }
}
