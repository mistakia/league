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

import { CholeskyDecomposition, Matrix } from 'ml-matrix'

// The penalty is on the STANDARDIZED scale, so it means the same thing whatever
// units the caller's features carry. A caller passing raw yardage beside a 0/1
// indicator would otherwise be penalizing the two by a factor of a thousand.
const DEFAULT_RIDGE_PENALTY = 1e-4
// Floor applied to whatever the caller asks for -- see the penalty construction
// below for why a zero penalty is not safe here.
const MINIMUM_RIDGE_PENALTY = 1e-8
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

// Solve the penalized normal equations by Cholesky.
//
// There is no general-solve fallback, deliberately. An earlier revision tried
// Cholesky and fell back to an LU solve when `isPositiveDefinite()` said no --
// which does not do what it reads like, in BOTH directions. On a rank-deficient
// positive SEMI-definite matrix `isPositiveDefinite()` returns TRUE, so the
// Cholesky branch is taken and returns coefficients of order 1e15; and on an
// exactly duplicated column it returns false and the LU fallback throws
// `LU matrix is singular`, which names nothing a caller can act on. The floor on
// the penalty below makes the matrix genuinely positive definite instead, so
// neither path is needed and a failure here is a real one worth surfacing.
const solve_normal_equations = ({ hessian, gradient }) => {
  const cholesky = new CholeskyDecomposition(hessian)
  if (!cholesky.isPositiveDefinite()) {
    throw new Error(
      'penalized normal equations are not positive definite: the design is rank-deficient beyond what the ridge penalty conditions. Raise ridge_penalty or drop a collinear feature.'
    )
  }
  return cholesky.solve(gradient)
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

  // Every feature value must be a finite NUMBER, and this check is not
  // defensive boilerplate -- without it a single bad value silently DELETES the
  // feature and the fit reports success. A NaN anywhere in a column makes that
  // column's standard deviation NaN; `NaN > 1e-12` is false, so the column is
  // classified zero-variance, standardizes to all zeros, and its coefficient is
  // pinned to 0 with `converged: true` and no warning. A string sneaks through
  // by concatenating in the mean loop, and a null coerces to 0 and is treated as
  // a real observation. These consumers build feature matrices from SQL result
  // sets of 10,000 to 50,000 rows, where exactly one null is the expected
  // failure -- and it would drop an entire feature from a valuation stage.
  for (let row = 0; row < features.length; row++) {
    if (features[row].length !== column_count) {
      throw new Error(
        `feature row ${row} has ${features[row].length} values, expected ${column_count}`
      )
    }
    for (let column = 0; column < column_count; column++) {
      const value = features[row][column]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(
          `feature value at row ${row}, column ${column} is ${JSON.stringify(value)}; every value must be a finite number`
        )
      }
    }
  }

  const { standardized, means, standard_deviations } =
    standardize_features(features)

  // Design matrix with an intercept in column 0. The intercept is never
  // penalized -- penalizing it would shrink the fitted base rate toward 0.5,
  // which is a claim about the outcome nobody asked the penalty to make.
  const design = new Matrix(standardized.map((row) => [1, ...row]))
  const parameter_count = column_count + 1

  // The penalty carries a FLOOR, and it is numerical conditioning rather than
  // shrinkage. At `ridge_penalty: 0` a rank-deficient design -- two features
  // that are exact linear combinations of each other, which a feature matrix
  // assembled from correlated football statistics can easily produce -- leaves
  // the normal equations singular, and `CholeskyDecomposition` does not
  // reliably detect it (see `solve_normal_equations`). A measured 2000-row fit
  // with `c = 2a + 3b` at zero penalty returned coefficients of 2.11 and 1.40
  // against truths of 1.0 and -0.5, `converged: false`, and nothing else to
  // read. 1e-8 on the STANDARDIZED scale conditions the matrix while moving an
  // O(1) coefficient by less than the convergence tolerance.
  const effective_ridge_penalty = Math.max(ridge_penalty, MINIMUM_RIDGE_PENALTY)
  const penalty = Matrix.eye(parameter_count).mul(effective_ridge_penalty)
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
    //
    // Formed as (√W X)ᵀ(√W X) rather than Xᵀ(WX). The two are equal in exact
    // arithmetic, but only the first is exactly symmetric in floating point: its
    // (i,j) and (j,i) entries multiply the same three factors in the same
    // association, so they agree bit for bit. Xᵀ(WX) associates them
    // differently and the triangles disagree in the last bits, which
    // `CholeskyDecomposition` -- which tests symmetry EXACTLY -- rejects with
    // "Matrix is not symmetric". Measured on a 5000x6 design spanning five
    // orders of magnitude in scale: max asymmetry 3.6e-7 for Xᵀ(WX), exactly 0
    // for this form. An earlier revision averaged the triangles instead; this
    // removes the need.
    const sqrt_weighted_design = new Matrix(design.rows, parameter_count)
    for (let row = 0; row < design.rows; row++) {
      const sqrt_weight = Math.sqrt(weights[row])
      for (let column = 0; column < parameter_count; column++) {
        sqrt_weighted_design.set(
          row,
          column,
          design.get(row, column) * sqrt_weight
        )
      }
    }
    const hessian = sqrt_weighted_design
      .transpose()
      .mmul(sqrt_weighted_design)
      .add(penalty)
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
    effective_ridge_penalty,
    iterations,
    converged,
    observations: features.length
  }
}

// Apply a fit to new rows, in the caller's own units. Kept here rather than in
// the consumer because the standardization transform is part of the fit and a
// consumer re-deriving it is how live and backtest predictions drift apart.
//
// It evaluates through the STANDARDIZED coefficients, not the raw ones, and that
// is a numerical choice rather than a stylistic one. The raw intercept absorbs
// `-Σ bⱼ mⱼ / sⱼ`, so on the raw path the linear predictor is a large number
// minus large numbers and cancels catastrophically once a feature's mean dwarfs
// its spread. Measured against the standardized path at a probability spread of
// about 0.55: a feature offset of 1e6 disagrees by 7e-11, 1e12 by 3e-5, and 1e15
// by 6.7e-2 -- which is a wrong answer. Yardage beside an indicator is safe, an
// epoch timestamp or an absolute year is not. Going through the standardization
// is exact at every scale, and it makes this comment's first paragraph true:
// before, the function claimed to carry the transform while not using it.
export const predict_logistic_probability = ({ fit, features }) =>
  features.map((row) => {
    let linear_predictor = fit.standardized_intercept
    for (let column = 0; column < row.length; column++) {
      const deviation = fit.feature_standard_deviations[column]
      if (deviation === 0) continue
      const standardized_value =
        (row[column] - fit.feature_means[column]) / deviation
      linear_predictor +=
        fit.standardized_coefficients[column] * standardized_value
    }
    return sigmoid(linear_predictor)
  })

export default fit_logistic_regression
