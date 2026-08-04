/* global describe it */

import * as chai from 'chai'

import fit_logistic_regression, {
  predict_logistic_probability
} from '#libs-server/dynasty-value/fit-logistic-regression.mjs'

chai.should()
const expect = chai.expect

// The module is hand-rolled IRLS, so "it ran and produced numbers" proves
// nothing. Four independent checks, in increasing strength:
//
//   1. Recovery -- fits synthetic data generated from known coefficients and
//      checks it finds them back. Statistical, so the tolerance is loose.
//   2. Optimality -- checks the penalized log-likelihood gradient is zero at the
//      returned coefficients. This is the DEFINING property of the estimate and
//      is independent of the algorithm used to reach it, so it catches an IRLS
//      step that converges to the wrong point.
//   3. Cross-implementation -- reruns the same fit by plain gradient ascent,
//      which shares no code path with the Newton solve, and requires agreement.
//   4. Raw-space recovery -- refits in the CALLER's units with an optimizer that
//      never standardizes, and compares raw coefficients.
//
// The fourth exists because the first three share a blind spot, and a 2026-08-04
// review proved it: checks 2 and 3 are both handed `fit.feature_means` and
// `fit.feature_standard_deviations` and both assert only on the STANDARDIZED
// parameters, so an error inside `standardize_features` is self-consistent
// across them and reads as a perfect zero gradient. Check 3 is an independent
// OPTIMIZER, not an independent MODEL. Only check 4 observes the standardization
// and the back-transform at all.
//
// Together these are the "coefficients match a fixture computed independently,
// to a stated tolerance" verify on the Groundwork item of
// user:task/league/rebuild-dynasty-asset-valuation.md. The stated tolerances are
// on each assertion.

const sigmoid = (value) => 1 / (1 + Math.exp(-value))

// Deterministic uniform generator. Fixed seed so a failure is reproducible and a
// flake is impossible -- there is no wall clock or Math.random anywhere here.
//
// `Math.imul` and `>>> 0` are load-bearing. The obvious spelling,
// `(state * 1103515245 + 12345) & 0x7fffffff`, reaches 2.4e18 before the mask --
// about 250x past Number.MAX_SAFE_INTEGER -- so the low bits are destroyed by
// float rounding before they are ever masked, and the generator collapses to a
// period of 10,466 for every seed used in this file. That is not a cosmetic
// flaw: it made the 20,000-observation recovery test below contain only 7,031
// distinct rows, so its tolerances were calibrated against a design that is 65%
// exact duplicates -- precisely the regime in which a conditioning defect hides.
// `Math.imul` keeps the multiply exact in 32 bits.
const make_random = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
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
    gradient[index] -= fit.effective_ridge_penalty * parameters[index]
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

  // The three tests below close bug classes the original spec provably could not
  // see. The gradient check and the gradient-ascent reference both read
  // `fit.feature_means` and `fit.feature_standard_deviations` and both assert
  // only on the STANDARDIZED parameters, so any error inside
  // `standardize_features` is self-consistent across all of them and reads as a
  // perfect zero gradient. The raw back-transform was likewise observed only by
  // a test that compared two paths sharing the same (possibly wrong) transform.

  it('recovers raw coefficients against a fit that never standardizes', () => {
    // The only check on `standardize_features` and the back-transform together.
    // The reference optimizes the RAW-space objective directly, so it shares no
    // centering, no scaling, and no parameterization with the module.
    const random = make_random(8675309)
    const intercept = 0.35
    const true_coefficients = [1.1, -0.7]
    const features = []
    const targets = []
    for (let row = 0; row < 1200; row++) {
      // Deliberately off-center and unequally scaled, so a wrong mean or a wrong
      // denominator inside the standardization cannot cancel. Kept to modest
      // magnitudes because the reference below is plain gradient ascent in RAW
      // space, which is only stable when the feature scale is O(1) -- a larger
      // offset diverges the REFERENCE and reads as a module failure.
      const feature_row = [5 + random() * 3, 2 + random() * 1.8]
      let linear_predictor = intercept
      for (let column = 0; column < 2; column++) {
        linear_predictor +=
          true_coefficients[column] *
          (feature_row[column] - (column === 0 ? 6.5 : 2.9))
      }
      features.push(feature_row)
      targets.push(random() < sigmoid(linear_predictor) ? 1 : 0)
    }

    const fit = fit_logistic_regression({
      features,
      targets,
      feature_names: ['offset_scale', 'small_scale'],
      ridge_penalty: 0
    })

    // Plain gradient ascent in RAW space. No standardization anywhere.
    const parameters = [0, 0, 0]
    const learning_rate = 2e-5
    for (let iteration = 0; iteration < 400000; iteration++) {
      const gradient = [0, 0, 0]
      for (let row = 0; row < features.length; row++) {
        const linear_predictor =
          parameters[0] +
          parameters[1] * features[row][0] +
          parameters[2] * features[row][1]
        const residual = targets[row] - sigmoid(linear_predictor)
        gradient[0] += residual
        gradient[1] += residual * features[row][0]
        gradient[2] += residual * features[row][1]
      }
      let max_step = 0
      for (let index = 0; index < 3; index++) {
        const step = learning_rate * gradient[index]
        parameters[index] += step
        max_step = Math.max(max_step, Math.abs(step))
      }
      if (max_step < 1e-11) break
    }

    expect(fit.coefficients[0]).to.be.closeTo(parameters[1], 1e-3)
    expect(fit.coefficients[1]).to.be.closeTo(parameters[2], 1e-3)
    expect(fit.intercept).to.be.closeTo(parameters[0], 5e-2)
  })

  it('predicts identically at a feature offset that breaks the raw path', () => {
    // The raw intercept absorbs -sum(b_j * m_j / s_j), so a raw-coefficient
    // prediction cancels catastrophically once a mean dwarfs its spread. This
    // pins the standardized evaluation: at an offset of 1e12 the raw path is
    // wrong in the third decimal of a probability.
    const random = make_random(20260804)
    const features = []
    const targets = []
    for (let row = 0; row < 2000; row++) {
      const value = 1e12 + random() * 2 - 1
      features.push([value])
      targets.push(random() < sigmoid(1.5 * (value - 1e12)) ? 1 : 0)
    }

    const fit = fit_logistic_regression({
      features,
      targets,
      feature_names: ['epoch_like']
    })
    const probabilities = predict_logistic_probability({
      fit,
      features: features.slice(0, 200)
    })

    for (let row = 0; row < 200; row++) {
      const deviation = fit.feature_standard_deviations[0]
      const standardized_value =
        (features[row][0] - fit.feature_means[0]) / deviation
      const expected = sigmoid(
        fit.standardized_intercept +
          fit.standardized_coefficients[0] * standardized_value
      )
      expect(probabilities[row]).to.be.closeTo(expected, 1e-12)
    }
    // And the predictions must still span the range rather than collapsing.
    expect(Math.max(...probabilities) - Math.min(...probabilities)).to.be.above(
      0.3
    )
  })

  it('conditions a rank-deficient design rather than returning garbage', () => {
    // A third feature that is an exact linear combination of the first two. At a
    // literal zero penalty the normal equations are singular and Cholesky's
    // positive-definiteness test does NOT catch it -- it returns true and the
    // solve yields coefficients of order 1e15. The penalty floor is what makes
    // this well posed.
    const random = make_random(31415)
    const features = []
    const targets = []
    for (let row = 0; row < 3000; row++) {
      const first = random() * 2 - 1
      const second = random() * 2 - 1
      features.push([first, second, 2 * first + 3 * second])
      targets.push(random() < sigmoid(0.2 + 1.0 * first - 0.5 * second) ? 1 : 0)
    }

    const fit = fit_logistic_regression({
      features,
      targets,
      feature_names: ['first', 'second', 'dependent'],
      ridge_penalty: 0
    })

    fit.converged.should.equal(true)
    fit.effective_ridge_penalty.should.be.above(0)
    for (const coefficient of fit.coefficients) {
      Math.abs(coefficient).should.be.below(100)
    }
    // The identified direction is what the collinear set can carry: the fitted
    // combination must reproduce the true linear predictor, even though the
    // individual coefficients are not separately identified.
    const first_effect = fit.coefficients[0] + 2 * fit.coefficients[2]
    const second_effect = fit.coefficients[1] + 3 * fit.coefficients[2]
    expect(first_effect).to.be.closeTo(1.0, 0.2)
    expect(second_effect).to.be.closeTo(-0.5, 0.2)
  })

  it('rejects a non-finite feature rather than silently dropping the column', () => {
    // The highest-severity input defect: without this check a single NaN makes
    // the column read as zero-variance, pins its coefficient to 0, and returns
    // converged: true. These consumers assemble features from SQL result sets
    // where exactly one null is the expected failure.
    const base = [
      [1, 5],
      [2, 6],
      [3, 7],
      [4, 8]
    ]
    const targets = [0, 1, 0, 1]

    for (const bad of [NaN, null, undefined, '3', Infinity]) {
      const features = base.map((row) => [...row])
      features[2][0] = bad
      expect(
        () => fit_logistic_regression({ features, targets, ridge_penalty: 0 }),
        `value ${String(bad)} must be rejected`
      ).to.throw('must be a finite number')
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
