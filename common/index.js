import weightProjections from './weight-projections'
import calculateBaselines from './calculate-baselines'
import calculatePoints from './calculate-points'
import calculateValues from './calculate-values'
import * as constants from './constants'
import getEligibleSlots from './get-eligible-slots'
import Roster from './roster'
import calculateStatsFromPlays from './calculate-stats-from-plays'
import createDefaultLeague from './create-default-league'

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
  groupBy,
  uniqBy,
  formatRoster,
  weightProjections,
  Roster,
  calculateStatsFromPlays,
  createDefaultLeague
}
