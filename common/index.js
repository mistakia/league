import weightProjections from './weight-projections'
import calculateBaselines from './calculate-baselines'
import calculatePoints from './calculate-points'
import calculateValues from './calculate-values'
import * as constants from './constants'
import getEligibleSlots from './get-eligible-slots'
import Roster from './roster'

const groupBy = (xs, key) => xs.reduce((rv, x) => {
  (rv[x[key]] = rv[x[key]] || []).push(x)
  return rv
}, {})

const formatRoster = (roster) => {
  const result = new Map()
  Object.keys(roster).forEach(k => k.startsWith('s') && result.set(k, roster[k]))
  return result
}

export {
  calculateBaselines,
  calculatePoints,
  calculateValues,
  constants,
  getEligibleSlots,
  groupBy,
  formatRoster,
  weightProjections,
  Roster
}
