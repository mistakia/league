import weightProjections from './weight-projections'
import calculateBaselines from './calculate-baselines'
import calculatePoints from './calculate-points'
import calculateValues from './calculate-values'
import * as constants from './constants'
import getEligibleSlots from './get-eligible-slots'
import Roster from './roster'
import calculateDstStatsFromPlays from './calculate-dst-stats-from-plays'
import calculateStatsFromPlayStats from './calculate-stats-from-play-stats'
import calculateStatsFromPlays from './calculate-stats-from-plays'
import calculatePrices from './calculate-prices'
import getRosterSize from './get-roster-size'
import getProjectedSnapsRemaining from './get-projected-snaps-remaining'
import createDefaultLeague from './create-default-league'
import getOptimizerPositionConstraints from './get-optimizer-position-constraints'
import isOnReleaseWaivers from './is-on-release-waivers'
import fixTeam from './fix-team'
import calculatePercentiles from './calculate-percentiles'

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

const toPercent = num => `${((num || 0) * 100).toFixed(1)}%`

const formatRoster = (roster) => {
  const result = new Map()
  Object.keys(roster).forEach(k => k.startsWith('s') && result.set(k, roster[k]))
  return result
}
const nth = (n) => ['st', 'nd', 'rd'][((n + 90) % 100 - 10) % 10 - 1] || 'th'

const toStringArray = (arr) => {
  return arr.length > 1
    ? arr.slice(0, -1).join(', ') + ', and ' + arr.slice(-1)
    : arr.toString()
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
  calculateStatsFromPlayStats,
  calculateStatsFromPlays,
  createDefaultLeague,
  getProjectedSnapsRemaining,
  getOptimizerPositionConstraints,
  calculateDstStatsFromPlays,
  isOnReleaseWaivers,
  nth,
  toStringArray,
  fixTeam,
  toPercent,
  calculatePercentiles
}
