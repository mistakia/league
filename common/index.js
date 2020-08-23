import weightProjections from './weight-projections'
import calculateBaselines from './calculate-baselines'
import calculatePoints from './calculate-points'
import calculateValues from './calculate-values'
import * as constants from './constants'
import getEligibleSlots from './get-eligible-slots'
import Roster from './roster'
import calculateStatsFromPlays from './calculate-stats-from-plays'
import calculatePrices from './calculate-prices'
import getRosterSize from './get-roster-size'
import createDefaultLeague from './create-default-league'
import getOptimizerPositionConstraints from './get-optimizer-position-constraints'
import isOnReleaseWaivers from './is-on-release-waivers'

const groupBy = (xs, key) => xs.reduce((rv, x) => {
  (rv[x[key]] = rv[x[key]] || []).push(x)
  return rv
}, {})

const uniqBy = (a, key) => {
  const seen = new Set()
  return a.filter(item => {
    const k = item[key]
    return seen.has(k) ? false : seen.add(k)
  })
}

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
  getRosterSize,
  groupBy,
  uniqBy,
  formatRoster,
  weightProjections,
  Roster,
  calculatePrices,
  calculateStatsFromPlays,
  createDefaultLeague,
  getOptimizerPositionConstraints,
  isOnReleaseWaivers
}
