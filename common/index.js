import weightProjections from './weight-projections'
import calculateBaselines from './calculate-baselines'
import calculatePoints from './calculate-points'
import calculateValues from './calculate-values'
import constants from './constants'

const groupBy = (xs, key) => xs.reduce((rv, x) => {
  (rv[x[key]] = rv[x[key]] || []).push(x)
  return rv
}, {})

export {
  weightProjections,
  calculateBaselines,
  calculatePoints,
  calculateValues,
  constants,
  groupBy
}
