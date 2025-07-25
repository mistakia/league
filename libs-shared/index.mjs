import * as constants from './constants.mjs'
import getDraftWindow from './get-draft-window.mjs'

export * as common_column_params from './common-column-params.mjs'
export * as data_views_constants from './data-views-constants.mjs'
export * as bookmaker_constants from './bookmaker-constants.mjs'
export { default as weightProjections } from './weight-projections.mjs'
export { default as calculateBaselines } from './calculate-baselines.mjs'
export { default as calculatePoints } from './calculate-points.mjs'
export { default as calculateValues } from './calculate-values.mjs'
export { default as get_eligible_slots } from './get-eligible-slots.mjs'
export { default as Roster } from './roster.mjs'
export { default as calculateDstStatsFromPlays } from './calculate-dst-stats-from-plays.mjs'
export { default as calculateStatsFromPlayStats } from './calculate-stats-from-play-stats.mjs'
export { default as calculateStatsFromPlays } from './calculate-stats-from-plays.mjs'
export { default as calculatePrices } from './calculate-prices.mjs'
export { default as getRosterSize } from './get-roster-size.mjs'
export { default as getProjectedSnapsRemaining } from './get-projected-snaps-remaining.mjs'
export { default as create_default_league } from './create-default-league.mjs'
export { default as getOptimizerPositionConstraints } from './get-optimizer-position-constraints.mjs'
export { default as isOnReleaseWaivers } from './is-on-release-waivers.mjs'
export { default as fixTeam } from './fix-team.mjs'
export { default as calculatePercentiles } from './calculate-percentiles.mjs'
export { default as getExtensionAmount } from './get-extension-amount.mjs'
export { default as calculateStandings } from './calculate-standings.mjs'
export { default as optimizeStandingsLineup } from './optimize-standings-lineup.mjs'
export { default as getPlayerCountBySlot } from './get-player-count-by-slot.mjs'
export { default as getActiveRosterLimit } from './get-active-roster-limit.mjs'
export { default as isReserveEligible } from './is-reserve-eligible.mjs'
export { default as isReserveCovEligible } from './is-reserve-cov-eligible.mjs'
export { default as isSlotActive } from './is-slot-active.mjs'
export { default as getDraftDates } from './get-draft-dates.mjs'
export { default as optimizeLineup } from './optimize-lineup.mjs'
export { default as simulate } from './simulate.mjs'
export { default as groupBy } from './group-by.mjs'
export { default as get_free_agent_period } from './get-free-agent-period.mjs'
export { default as calculatePlayerValuesRestOfSeason } from './calculate-player-values-rest-of-season.mjs'
export { default as getPlayFromPlayStats } from './get-play-from-play-stats.mjs'
export { default as isSantuaryPeriod } from './is-santuary-period.mjs'
export { default as getYardlineInfoFromString } from './get-yardline-info-from-string.mjs'
export * as Errors from './errors.mjs'
export { default as getGameDayAbbreviation } from './get-game-day-abbreviation.mjs'
export { default as getPoachProcessingTime } from './get-poach-processing-time.mjs'
export { default as formatHeight } from './format-height.mjs'
export { default as format_player_name } from './format-player-name.mjs'
export { default as sum } from './sum.mjs'
export { default as Season } from './season.mjs'
export { default as median } from './median.mjs'
export { default as team_aliases } from './team-aliases.mjs'
export { default as convert_to_csv } from './convert-to-csv.mjs'
export { default as formatPosition } from './format-position.mjs'
export { default as generate_league_format_hash } from './generate-league-format-hash.mjs'
export { default as generate_scoring_format_hash } from './generate-scoring-format-hash.mjs'
export { default as is_league_post_season_week } from './is-league-post-season-week.mjs'
export { default as get_string_from_object } from './get-string-from-object.mjs'
export { default as format_nfl_status } from './format-nfl-status.mjs'
export { default as format_nfl_injury_status } from './format-nfl-injury-status.mjs'
export { default as nfl_plays_column_params } from './nfl-plays-column-params.mjs'
export * as rate_type_column_param from './rate-type-column-param.mjs'
export * as job_constants from './job-constants.mjs'
export { default as data_view_fields_index } from './data-view-fields-index.mjs'
export { default as league_has_starting_position } from './league-has-starting-position.mjs'
export { default as nfl_plays_team_column_params } from './nfl-plays-team-column-params.mjs'
export { default as get_restricted_free_agency_nomination_info } from './get-restricted-free-agency-nomination-info.mjs'
export { named_scoring_formats } from './named-scoring-formats-generated.mjs'
export { named_league_formats } from './named-league-formats-generated.mjs'
export {
  DEFAULT_SCORING_FORMAT_HASH,
  DEFAULT_LEAGUE_FORMAT_HASH,
  default_format_hashes
} from './default-format-hashes.mjs'

export const uniqBy = (a, key) => {
  const seen = new Set()
  return a.filter((item) => {
    const k = item[key]
    return seen.has(k) ? false : seen.add(k)
  })
}

export const arrayToSentence = (arr) =>
  arr.length > 1
    ? arr.slice(0, arr.length - 1).join(', ') + ', and ' + arr.slice(-1)
    : arr[0]
export const toPercent = (num) => `${((num || 0) * 100).toFixed(1)}%`

export const formatRoster = (roster) => {
  const result = new Map()
  Object.keys(roster).forEach(
    (k) => k.startsWith('s') && result.set(k, roster[k])
  )
  return result
}
export const nth = (n) =>
  ['st', 'nd', 'rd'][((((n + 90) % 100) - 10) % 10) - 1] || 'th'

export const toStringArray = (arr) => {
  return arr.length > 1
    ? arr.slice(0, -1).join(', ') + ', and ' + arr.slice(-1)
    : arr.toString()
}

export const debounce = (callback, wait) => {
  let timeout = null
  return (...args) => {
    const next = () => callback(...args)
    clearTimeout(timeout)
    timeout = setTimeout(next, wait)
  }
}

export const isDraftWindowOpen = (params) =>
  constants.season.now.isAfter(getDraftWindow(params))

export const uuidv4 = () =>
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  )

export const get_last_consecutive_pick = (draft_picks = []) => {
  const sorted_picks = draft_picks.sort((a, b) => a.pick - b.pick)
  let last_consecutive_pick = sorted_picks[0]
  if (!last_consecutive_pick) return null

  let i = 1
  while (sorted_picks[i]?.pid) {
    last_consecutive_pick = sorted_picks[i]
    i++
  }

  return last_consecutive_pick
}

export { constants, getDraftWindow }
