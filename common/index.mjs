import weightProjections from './weight-projections.mjs'
import calculateBaselines from './calculate-baselines.mjs'
import calculatePoints from './calculate-points.mjs'
import calculateValues from './calculate-values.mjs'
import * as constants from './constants.mjs'
import getEligibleSlots from './get-eligible-slots.mjs'
import Roster from './roster.mjs'
import calculateDstStatsFromPlays from './calculate-dst-stats-from-plays.mjs'
import calculateStatsFromPlayStats from './calculate-stats-from-play-stats.mjs'
import calculateStatsFromPlays from './calculate-stats-from-plays.mjs'
import calculatePrices from './calculate-prices.mjs'
import getRosterSize from './get-roster-size.mjs'
import getProjectedSnapsRemaining from './get-projected-snaps-remaining.mjs'
import createDefaultLeague from './create-default-league.mjs'
import getOptimizerPositionConstraints from './get-optimizer-position-constraints.mjs'
import isOnReleaseWaivers from './is-on-release-waivers.mjs'
import fixTeam from './fix-team.mjs'
import calculatePercentiles from './calculate-percentiles.mjs'
import getExtensionAmount from './get-extension-amount.mjs'
import calculateStandings from './calculate-standings.mjs'
import optimizeStandingsLineup from './optimize-standings-lineup.mjs'
import getPlayerCountBySlot from './get-player-count-by-slot.mjs'
import getActiveRosterLimit from './get-active-roster-limit.mjs'
import isReserveEligible from './is-reserve-eligible.mjs'
import isReserveCovEligible from './is-reserve-cov-eligible.mjs'
import isSlotActive from './is-slot-active.mjs'
import getDraftWindow from './get-draft-window.mjs'
import getDraftDates from './get-draft-dates.mjs'
import optimizeLineup from './optimize-lineup.mjs'
import simulate from './simulate.mjs'
import groupBy from './group-by.mjs'
import getFreeAgentPeriod from './get-free-agent-period.mjs'
import calculatePlayerValuesRestOfSeason from './calculate-player-values-rest-of-season.mjs'
import getPlayFromPlayStats from './get-play-from-play-stats.mjs'
import isSantuaryPeriod from './is-santuary-period.mjs'
import getYardlineInfoFromString from './get-yardline-info-from-string.mjs'
import * as Errors from './errors.mjs'
import getGameDayAbbreviation from './get-game-day-abbreviation.mjs'
export { default as getPoachProcessingTime } from './get-poach-processing-time.mjs'
export { default as formatHeight } from './format-height.mjs'
export { default as formatPlayerName } from './format-player-name.mjs'
export { default as sum } from './sum.mjs'
export { default as Season } from './season.mjs'
export { default as median } from './median.mjs'
export { default as team_aliases } from './team-aliases.mjs'

const uniqBy = (a, key) => {
  const seen = new Set()
  return a.filter((item) => {
    const k = item[key]
    return seen.has(k) ? false : seen.add(k)
  })
}

const arrayToSentence = (arr) =>
  arr.length > 1
    ? arr.slice(0, arr.length - 1).join(', ') + ', and ' + arr.slice(-1)
    : arr[0]
const toPercent = (num) => `${((num || 0) * 100).toFixed(1)}%`

const formatRoster = (roster) => {
  const result = new Map()
  Object.keys(roster).forEach(
    (k) => k.startsWith('s') && result.set(k, roster[k])
  )
  return result
}
const nth = (n) =>
  ['st', 'nd', 'rd'][((((n + 90) % 100) - 10) % 10) - 1] || 'th'

const toStringArray = (arr) => {
  return arr.length > 1
    ? arr.slice(0, -1).join(', ') + ', and ' + arr.slice(-1)
    : arr.toString()
}

const debounce = (callback, wait) => {
  let timeout = null
  return (...args) => {
    // eslint-disable-next-line
    const next = () => callback(...args)
    clearTimeout(timeout)
    timeout = setTimeout(next, wait)
  }
}

const isDraftWindowOpen = (params) =>
  constants.season.now.isAfter(getDraftWindow(params))

export {
  debounce,
  arrayToSentence,
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
  calculatePercentiles,
  getExtensionAmount,
  calculateStandings,
  optimizeStandingsLineup,
  getPlayerCountBySlot,
  getActiveRosterLimit,
  isReserveEligible,
  isReserveCovEligible,
  isSlotActive,
  getDraftWindow,
  isDraftWindowOpen,
  getDraftDates,
  Errors,
  optimizeLineup,
  simulate,
  getFreeAgentPeriod,
  calculatePlayerValuesRestOfSeason,
  isSantuaryPeriod,
  getYardlineInfoFromString,
  getPlayFromPlayStats,
  getGameDayAbbreviation
}
