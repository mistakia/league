// Multivariate logistic regression, fit by iteratively reweighted least squares
// with an L2 (ridge) penalty.
//
// Hand-rolled because no dependency here provides it -- VERIFIED 2026-07-30 and
// re-verified 2026-08-04: `jstat` exposes ordinary least squares only,
// `regression@2.0.1` carries no logistic model, and `simple-statistics` exports
// a logistic CDF helper rather than a fit. `ml-matrix` supplies the linear
// algebra, which is the same posture `libs-shared/simulation/generate-correlated-samples.mjs`
// takes with `CholeskyDecomposition`.
//
// Shared by three call sites in the dynasty valuation build: stage one's binary
// component (does a player have value in a season at all), and the classification
// steps inside stages three and four.
//
// NOT provided, deliberately: cluster-robust standard errors. No gate in
// user:task/league/rebuild-dynasty-asset-valuation.md reads a coefficient
// standard error -- all seven are held-out error margins whose inference comes
// from the clustered bootstrap that already exists in the harness. Building both
// would be two mechanisms for one job.

import { CholeskyDecomposition, Matrix, solve } from 'ml-matrix'

// The penalty is on the STANDARDIZED scale, so it means the same thing whatever
// units the caller's features carry. A caller passing raw yardage beside a 0/1
// indicator would otherwise be penalizing the two by a factor of a thousand.
const DEFAULT_RIDGE_PENALTY = 1e-4
const DEFAULT_MAX_ITERATIONS = 100
const DEFAULT_TOLERANCE = 1e-8

// Probabilities are clamped away from the open interval's ends before forming
// the IRLS weight p*(1-p). Under separation that weight goes to zero, the normal
// equations become singular, and the fit fails with a linear-algebra error that
// says nothing about the data. Clamping turns that into a coefficient that
// simply grows until the iteration limit, which the caller can see.
const PROBABILITY_FLOOR = 1e-10

const sigmoid = (value) => {
  // Split by sign so neither branch evaluates exp() of a large positive number.
  if (value >= 0) {
    return 1 / (1 + Math.exp(-value))
  }
  const exponential = Math.exp(value)
  return exponential / (1 + exponential)
}

// Center and scale each column, and record the transform so coefficients can be
// mapped back to the caller's own units. A column with no variation is left
// alone and its coefficient is pinned to zero rather than dividing by zero.
const standardize_features = (feature_rows) => {
  const row_count = feature_rows.length
  const column_count = feature_rows[0].length
  const means = new Array(column_count).fill(0)
  const standard_deviations = new Array(column_count).fill(1)

  for (let column = 0; column < column_count; column++) {
    let total = 0
    for (let row = 0; row < row_count; row++) total += feature_rows[row][column]
    means[column] = total / row_count

    let sum_squares = 0
    for (let row = 0; row < row_count; row++) {
      const deviation = feature_rows[row][column] - means[column]
      sum_squares += deviation * deviation
    }
    const deviation = Math.sqrt(sum_squares / row_count)
    standard_deviations[column] = deviation > 1e-12 ? deviation : 0
  }

  const standardized = feature_rows.map((row) =>
    row.map((value, column) =>
      standard_deviations[column] === 0
        ? 0
        : (value - means[column]) / standard_deviations[column]
    )
  )

  return { standardized, means, standard_deviations }
}

// XᵀWX is symmetric in exact arithmetic but not in floating point -- the two
// triangles differ in the last bits, and `CholeskyDecomposition` tests symmetry
// EXACTLY and throws "Matrix is not symmetric" on the difference. Averaging the
// triangles restores the symmetry the mathematics already guarantees.
const symmetrize = (matrix) => {
  const size = matrix.rows
  const result = new Matrix(size, size)
  for (let row = 0; row < size; row++) {
    for (let column = row; column < size; column++) {
      const average = (matrix.get(row, column) + matrix.get(column, row)) / 2
      result.set(row, column, average)
      result.set(column, row, average)
    }
  }
  return result
}

// Solve the penalized normal equations. Cholesky is tried first because the
// matrix is symmetric positive definite whenever the penalty is positive and it
// is the cheaper factorization; a general solve is the fallback for the
// unpenalized case, where the matrix can be merely positive semi-definite.
const solve_normal_equations = ({ hessian, gradient }) => {
  const symmetric = symmetrize(hessian)
  const cholesky = new CholeskyDecomposition(symmetric)
  if (cholesky.isPositiveDefinite()) {
    return cholesky.solve(gradient)
  }
  return solve(symmetric, gradient)
}

// Fit by IRLS. Each iteration forms the working response and weights of the
// local quadratic approximation and solves the weighted least squares problem
// they define, which is Newton-Raphson on the log-likelihood.
//
// `features` is row-major: one array per observation, one entry per feature, in
// a fixed order the caller also uses for `feature_names`. `targets` is 0/1.
const fit_logistic_regression = ({
  features,
  targets,
  feature_names,
  ridge_penalty = DEFAULT_RIDGE_PENALTY,
  max_iterations = DEFAULT_MAX_ITERATIONS,
  tolerance = DEFAULT_TOLERANCE
}) => {
  if (!Array.isArray(features) || features.length === 0) {
    throw new Error('fit_logistic_regression requires at least one observation')
  }
  if (features.length !== targets.length) {
    throw new Error(
      `feature rows (${features.length}) and targets (${targets.length}) must be the same length`
    )
  }
  const column_count = features[0].length
  if (feature_names && feature_names.length !== column_count) {
    throw new Error(
      `feature_names (${feature_names.length}) must match feature count (${column_count})`
    )
  }
  for (const target of targets) {
    if (target !== 0 && target !== 1) {
      throw new Error('targets must be 0 or 1')
    }
  }

  const { standardized, means, standard_deviations } =
    standardize_features(features)

  // Design matrix with an intercept in column 0. The intercept is never
  // penalized -- penalizing it would shrink the fitted base rate toward 0.5,
  // which is a claim about the outcome nobody asked the penalty to make.
  const design = new Matrix(standardized.map((row) => [1, ...row]))
  const parameter_count = column_count + 1
  const penalty = Matrix.eye(parameter_count).mul(ridge_penalty)
  penalty.set(0, 0, 0)

  // A zero-variance feature standardizes to an all-zero column, which
  // contributes nothing to XᵀWX and leaves that parameter's row and column
  // entirely zero -- a singular system whenever the caller passes no penalty.
  // Pinning a unit penalty on exactly those parameters makes the system
  // non-singular and drives the coefficient to 0, which is the answer: a
  // feature that never varies cannot carry an effect.
  for (let column = 0; column < column_count; column++) {
    if (standard_deviations[column] === 0) {
      penalty.set(column + 1, column + 1, 1)
    }
  }

  let coefficients = Matrix.zeros(parameter_count, 1)
  let iterations = 0
  let converged = false

  for (; iterations < max_iterations; iterations++) {
    const linear_predictor = design.mmul(coefficients)
    const weights = new Array(design.rows)
    const working_residual = new Array(design.rows)

    for (let row = 0; row < design.rows; row++) {
      const probability = sigmoid(linear_predictor.get(row, 0))
      const clamped = Math.min(
        Math.max(probability, PROBABILITY_FLOOR),
        1 - PROBABILITY_FLOOR
      )
      weights[row] = clamped * (1 - clamped)
      working_residual[row] = targets[row] - probability
    }

    // hessian = XᵀWX + penalty, gradient = Xᵀ(y - p) - penalty * beta
    const weighted_design = new Matrix(design.rows, parameter_count)
    for (let row = 0; row < design.rows; row++) {
      for (let column = 0; column < parameter_count; column++) {
        weighted_design.set(row, column, design.get(row, column) * weights[row])
      }
    }
    const hessian = design.transpose().mmul(weighted_design).add(penalty)
    const gradient = design
      .transpose()
      .mmul(Matrix.columnVector(working_residual))
      .sub(penalty.mmul(coefficients))

    const step = solve_normal_equations({ hessian, gradient })
    const next = coefficients.clone().add(step)

    let max_change = 0
    for (let index = 0; index < parameter_count; index++) {
      max_change = Math.max(
        max_change,
        Math.abs(next.get(index, 0) - coefficients.get(index, 0))
      )
    }
    coefficients = next
    if (max_change < tolerance) {
      converged = true
      iterations += 1
      break
    }
  }

  // Map back to the caller's units. A standardized coefficient b_j corresponds
  // to b_j / sd_j on the raw scale, and the intercept absorbs the centering.
  const standardized_coefficients = coefficients.to1DArray()
  const raw_coefficients = new Array(column_count)
  let raw_intercept = standardized_coefficients[0]
  for (let column = 0; column < column_count; column++) {
    const deviation = standard_deviations[column]
    const standardized_coefficient = standardized_coefficients[column + 1]
    if (deviation === 0) {
      raw_coefficients[column] = 0
      continue
    }
    raw_coefficients[column] = standardized_coefficient / deviation
    raw_intercept -= (standardized_coefficient * means[column]) / deviation
  }

  const names =
    feature_names || features[0].map((_, index) => `feature_${index}`)

  return {
    intercept: raw_intercept,
    coefficients: raw_coefficients,
    feature_names: names,
    coefficients_by_name: Object.fromEntries(
      names.map((name, index) => [name, raw_coefficients[index]])
    ),
    standardized_intercept: standardized_coefficients[0],
    standardized_coefficients: standardized_coefficients.slice(1),
    feature_means: means,
    feature_standard_deviations: standard_deviations,
    ridge_penalty,
    iterations,
    converged,
    observations: features.length
  }
}

// Apply a fit to new rows, in the caller's own units. Kept here rather than in
// the consumer because the standardization transform is part of the fit and a
// consumer re-deriving it is how live and backtest predictions drift apart.
export const predict_logistic_probability = ({ fit, features }) =>
  features.map((row) => {
    let linear_predictor = fit.intercept
    for (let column = 0; column < row.length; column++) {
      linear_predictor += fit.coefficients[column] * row[column]
    }
    return sigmoid(linear_predictor)
  })

export default fit_logistic_regression
