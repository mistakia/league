/* global describe it */

import * as chai from 'chai'

import fit_logistic_regression, {
  predict_logistic_probability
} from '#libs-server/dynasty-value/fit-logistic-regression.mjs'

chai.should()
const expect = chai.expect

// The module is hand-rolled IRLS, so "it ran and produced numbers" proves
// nothing. Three independent checks, in increasing strength:
//
//   1. Recovery -- fits synthetic data generated from known coefficients and
//      checks it finds them back. Statistical, so the tolerance is loose.
//   2. Optimality -- checks the penalized log-likelihood gradient is zero at the
//      returned coefficients. This is the DEFINING property of the estimate and
//      is independent of the algorithm used to reach it, so it catches an IRLS
//      step that converges to the wrong point.
//   3. Cross-implementation -- reruns the same fit by plain gradient ascent,
//      which shares no code path with the Newton solve, and requires agreement.
//
// Together these are the "coefficients match a fixture computed independently,
// to a stated tolerance" verify on the Groundwork item of
// user:task/league/rebuild-dynasty-asset-valuation.md. The stated tolerances are
// on each assertion.

const sigmoid = (value) => 1 / (1 + Math.exp(-value))

// Deterministic uniform generator. Fixed seed so a failure is reproducible and a
// flake is impossible -- there is no wall clock or Math.random anywhere here.
const make_random = (seed) => {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

const generate_dataset = ({
  observations,
  intercept,
  coefficients,
  seed = 12345,
  feature_scales = null
}) => {
  const random = make_random(seed)
  const features = []
  const targets = []
  for (let row = 0; row < observations; row++) {
    const feature_row = coefficients.map((_, column) => {
      const raw = random() * 2 - 1
      return feature_scales ? raw * feature_scales[column] : raw
    })
    let linear_predictor = intercept
    for (let column = 0; column < coefficients.length; column++) {
      linear_predictor += coefficients[column] * feature_row[column]
    }
    features.push(feature_row)
    targets.push(random() < sigmoid(linear_predictor) ? 1 : 0)
  }
  return { features, targets }
}

// Gradient of the penalized log-likelihood, in the STANDARDIZED parameterization
// the fit optimizes in. Written out from the definition rather than reusing any
// of the module's internals.
const penalized_gradient = ({ fit, features, targets }) => {
  const standardized_rows = features.map((row) =>
    row.map((value, column) =>
      fit.feature_standard_deviations[column] === 0
        ? 0
        : (value - fit.feature_means[column]) /
          fit.feature_standard_deviations[column]
    )
  )
  const parameters = [
    fit.standardized_intercept,
    ...fit.standardized_coefficients
  ]
  const gradient = new Array(parameters.length).fill(0)

  for (let row = 0; row < standardized_rows.length; row++) {
    let linear_predictor = parameters[0]
    for (let column = 0; column < standardized_rows[row].length; column++) {
      linear_predictor +=
        parameters[column + 1] * standardized_rows[row][column]
    }
    const residual = targets[row] - sigmoid(linear_predictor)
    gradient[0] += residual
    for (let column = 0; column < standardized_rows[row].length; column++) {
      gradient[column + 1] += residual * standardized_rows[row][column]
    }
  }

  // The intercept is unpenalized, matching the module.
  for (let index = 1; index < parameters.length; index++) {
    gradient[index] -= fit.ridge_penalty * parameters[index]
  }
  return gradient
}

// Independent estimator: plain gradient ascent on the same penalized objective,
// in the same standardized parameterization. Slow and dumb on purpose -- it
// shares no linear algebra with the module under test.
const fit_by_gradient_ascent = ({
  features,
  targets,
  ridge_penalty,
  means,
  deviations
}) => {
  const standardized_rows = features.map((row) =>
    row.map((value, column) =>
      deviations[column] === 0
        ? 0
        : (value - means[column]) / deviations[column]
    )
  )
  const parameter_count = features[0].length + 1
  const parameters = new Array(parameter_count).fill(0)
  const learning_rate = 0.5 / features.length

  for (let iteration = 0; iteration < 400000; iteration++) {
    const gradient = new Array(parameter_count).fill(0)
    for (let row = 0; row < standardized_rows.length; row++) {
      let linear_predictor = parameters[0]
      for (let column = 0; column < standardized_rows[row].length; column++) {
        linear_predictor +=
          parameters[column + 1] * standardized_rows[row][column]
      }
      const residual = targets[row] - sigmoid(linear_predictor)
      gradient[0] += residual
      for (let column = 0; column < standardized_rows[row].length; column++) {
        gradient[column + 1] += residual * standardized_rows[row][column]
      }
    }
    for (let index = 1; index < parameter_count; index++) {
      gradient[index] -= ridge_penalty * parameters[index]
    }
    let max_step = 0
    for (let index = 0; index < parameter_count; index++) {
      const step = learning_rate * gradient[index]
      parameters[index] += step
      max_step = Math.max(max_step, Math.abs(step))
    }
    if (max_step < 1e-12) break
  }
  return parameters
}

describe('LIBS SERVER fit-logistic-regression', function () {
  this.timeout(60000)

  it('recovers known coefficients from synthetic data', () => {
    const intercept = -0.75
    const coefficients = [2.5, -1.5, 0.8]
    const { features, targets } = generate_dataset({
      observations: 20000,
      intercept,
      coefficients,
      seed: 4242
    })

    const fit = fit_logistic_regression({
      features,
      targets,
      feature_names: ['first', 'second', 'third'],
      ridge_penalty: 0
    })

    fit.converged.should.equal(true)
    // Sampling tolerance at n=20000. The estimator is consistent, not exact, so
    // this is a wide band deliberately -- the tight checks are below.
    expect(fit.intercept).to.be.closeTo(intercept, 0.1)
    for (let index = 0; index < coefficients.length; index++) {
      expect(fit.coefficients[index]).to.be.closeTo(coefficients[index], 0.15)
    }
    fit.coefficients_by_name.first.should.equal(fit.coefficients[0])
  })

  it('returns coefficients where the penalized gradient is zero', () => {
    const { features, targets } = generate_dataset({
      observations: 3000,
      intercept: 0.4,
      coefficients: [1.2, -0.6],
      seed: 777
    })

    const fit = fit_logistic_regression({
      features,
      targets,
      feature_names: ['first', 'second'],
      ridge_penalty: 1e-3
    })

    fit.converged.should.equal(true)
    const gradient = penalized_gradient({ fit, features, targets })
    // The optimality condition, scaled by the sample size so the tolerance is a
    // per-observation quantity rather than one that loosens as n grows.
    for (const component of gradient) {
      expect(Math.abs(component) / features.length).to.be.below(1e-9)
    }
  })

  it('agrees with an independent gradient-ascent fit to 1e-6', () => {
    const { features, targets } = generate_dataset({
      observations: 1500,
      intercept: -0.3,
      coefficients: [0.9, 1.4],
      seed: 31337
    })
    const ridge_penalty = 1e-2

    const fit = fit_logistic_regression({
      features,
      targets,
      feature_names: ['first', 'second'],
      ridge_penalty
    })
    const reference = fit_by_gradient_ascent({
      features,
      targets,
      ridge_penalty,
      means: fit.feature_means,
      deviations: fit.feature_standard_deviations
    })

    const fitted = [
      fit.standardized_intercept,
      ...fit.standardized_coefficients
    ]
    for (let index = 0; index < fitted.length; index++) {
      expect(fitted[index]).to.be.closeTo(reference[index], 1e-6)
    }
  })

  it('maps coefficients back to raw feature units', () => {
    // Feature scales differ by three orders of magnitude, which is the case the
    // internal standardization exists for. If the back-transform were wrong the
    // recovered coefficients would be off by exactly those scales.
    const coefficients = [0.004, -3.5]
    const { features, targets } = generate_dataset({
      observations: 20000,
      intercept: 0.2,
      coefficients,
      seed: 5150,
      feature_scales: [1000, 1]
    })

    const fit = fit_logistic_regression({
      features,
      targets,
      feature_names: ['yards', 'indicator'],
      ridge_penalty: 0
    })

    expect(fit.coefficients[0]).to.be.closeTo(coefficients[0], 0.0008)
    expect(fit.coefficients[1]).to.be.closeTo(coefficients[1], 0.3)

    // Predictions computed from the RAW coefficients must reproduce the
    // standardized linear predictor exactly, which is what makes the returned
    // fit usable by a consumer that never sees the standardization.
    const probabilities = predict_logistic_probability({
      fit,
      features: features.slice(0, 50)
    })
    for (let row = 0; row < 50; row++) {
      let standardized_predictor = fit.standardized_intercept
      for (let column = 0; column < features[row].length; column++) {
        const deviation = fit.feature_standard_deviations[column]
        const standardized_value =
          deviation === 0
            ? 0
            : (features[row][column] - fit.feature_means[column]) / deviation
        standardized_predictor +=
          fit.standardized_coefficients[column] * standardized_value
      }
      expect(probabilities[row]).to.be.closeTo(
        sigmoid(standardized_predictor),
        1e-9
      )
    }
  })

  it('pins a constant feature to a zero coefficient rather than dividing by zero', () => {
    const { features, targets } = generate_dataset({
      observations: 500,
      intercept: 0.1,
      coefficients: [1.0],
      seed: 99
    })
    const with_constant = features.map((row) => [...row, 7])

    const fit = fit_logistic_regression({
      features: with_constant,
      targets,
      feature_names: ['live', 'constant'],
      ridge_penalty: 0
    })

    fit.coefficients[1].should.equal(0)
    Number.isFinite(fit.intercept).should.equal(true)
    Number.isFinite(fit.coefficients[0]).should.equal(true)
  })

  it('survives perfectly separated data without throwing', () => {
    // Separation drives the maximum likelihood estimate to infinity. The module
    // must degrade into a large coefficient the caller can inspect, not a
    // singular-matrix error that says nothing about the data.
    const features = []
    const targets = []
    for (let index = 0; index < 200; index++) {
      const value = index < 100 ? -1 - index / 100 : 1 + index / 100
      features.push([value])
      targets.push(index < 100 ? 0 : 1)
    }

    const fit = fit_logistic_regression({
      features,
      targets,
      feature_names: ['separator'],
      ridge_penalty: 0
    })

    Number.isFinite(fit.coefficients[0]).should.equal(true)
    fit.coefficients[0].should.be.above(0)
    const probabilities = predict_logistic_probability({ fit, features })
    probabilities[0].should.be.below(0.01)
    probabilities[199].should.be.above(0.99)
  })

  it('shrinks coefficients toward zero as the ridge penalty rises', () => {
    const { features, targets } = generate_dataset({
      observations: 800,
      intercept: 0.0,
      coefficients: [2.0, -2.0],
      seed: 2024
    })

    const light = fit_logistic_regression({
      features,
      targets,
      ridge_penalty: 1e-6
    })
    const heavy = fit_logistic_regression({
      features,
      targets,
      ridge_penalty: 500
    })

    for (let index = 0; index < 2; index++) {
      Math.abs(heavy.standardized_coefficients[index]).should.be.below(
        Math.abs(light.standardized_coefficients[index])
      )
    }
  })

  it('rejects malformed input rather than fitting it', () => {
    expect(() =>
      fit_logistic_regression({ features: [], targets: [] })
    ).to.throw('at least one observation')
    expect(() =>
      fit_logistic_regression({ features: [[1], [2]], targets: [1] })
    ).to.throw('must be the same length')
    expect(() =>
      fit_logistic_regression({ features: [[1], [2]], targets: [1, 2] })
    ).to.throw('targets must be 0 or 1')
    expect(() =>
      fit_logistic_regression({
        features: [[1, 2]],
        targets: [1],
        feature_names: ['only_one']
      })
    ).to.throw('must match feature count')
  })
})
