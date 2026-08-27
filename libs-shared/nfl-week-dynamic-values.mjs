// @ts-check
import { current_season } from '#constants'
import {
  current_nfl_week_identifier,
  last_completed_nfl_week_identifier,
  format_nfl_week_identifier,
  format_nfl_week_param_values,
  get_nfl_week_identifiers_for_year,
  group_nfl_weeks,
  compare_nfl_week_group_keys,
  nfl_week_offset_params
} from './nfl-week-identifier.mjs'

/**
 * @typedef {import('./nfl-week-identifier.mjs').NflWeekIdentifier} NflWeekIdentifier
 */

// ONE measure for what a dynamic nfl_week_id value means, feeding three
// presentations. It used to be four near-copies of the same switch -- the
// server expander, the client notice preview, the filter-chip label and the
// single-week resolver -- and they had already drifted: `last_n_nfl_years`
// anchored on the current season in two of them and on the last completed one
// in the third, so the chip preview was off by a season for half the year.
//
// Anchors, and why each is the one it is:
//
//   current_year_reg_weeks   current_season.year          forward-looking
//   current_nfl_week         current_season.year          forward-looking
//   last_completed_nfl_week  last_completed_season_year   retrospective
//   last_n_nfl_weeks         walks back from current      retrospective
//   last_n_nfl_years         last_completed_season_year   retrospective
//
// "Current Year REG Weeks" naming a season that ENDED is the same defect as the
// current week doing it: in the offseason the user asking for the current
// year's regular season means the one about to start.

const MIN_YEAR = 2000

/** The declared vocabulary. A type absent from here cannot be resolved. */
export const NFL_WEEK_DYNAMIC_TYPES = [
  'current_nfl_week',
  'last_completed_nfl_week',
  'current_year_reg_weeks',
  'last_n_nfl_weeks',
  'last_n_nfl_years'
]

/**
 * Resolves one dynamic value to the concrete nfl_week_id list it names.
 *
 * THROWS on an unrecognized type rather than answering an empty list. That is
 * the whole point of the consolidation: an unresolvable dynamic used to
 * contribute zero weeks while still reading as an explicit time scope, which
 * skips the take-view-scope-verbatim early return and leaves the row axis
 * unbounded. The symptom is a 13M-row fan-out with a correct-looking result
 * set, so no review and no golden can catch it. A known type reaching a
 * resolver that cannot expand it is the same defect as an unknown one.
 *
 * @param {{ dynamic_type: string, value?: any }} params
 * @returns {NflWeekIdentifier[]}
 */
export const resolve_nfl_week_dynamic_value = ({ dynamic_type, value }) => {
  switch (dynamic_type) {
    case 'current_nfl_week':
      return [current_nfl_week_identifier()]

    case 'last_completed_nfl_week': {
      const identifier = last_completed_nfl_week_identifier()
      return identifier ? [identifier] : []
    }

    case 'current_year_reg_weeks':
      return get_nfl_week_identifiers_for_year({
        year: current_season.year,
        seas_type: 'REG'
      })

    case 'last_n_nfl_weeks': {
      const n = parseInt(value || 5, 10)
      const result = []
      for (let i = 0; i < n; i++) {
        const params = nfl_week_offset_params({ offset: -i })
        if (!params) break
        result.push(format_nfl_week_identifier(params))
      }
      return result
    }

    case 'last_n_nfl_years': {
      const n = parseInt(value || 3, 10)
      const result = []
      for (let i = 0; i < n; i++) {
        const year = current_season.last_completed_season_year - i
        if (year < MIN_YEAR) break
        result.push(...get_nfl_week_identifiers_for_year({ year }))
      }
      return result
    }

    default:
      throw new Error(
        `resolve_nfl_week_dynamic_value: unknown dynamic_type "${dynamic_type}"`
      )
  }
}

/**
 * A compact label for a resolved list -- `2024-2026 PRE/REG/POST`.
 *
 * The presentation surfaces need this rather than the full enumeration: a
 * three-year list is nine (year, seas_type) groups and roughly eighty weeks,
 * which is not a filter chip. Derived FROM the resolved list so it cannot
 * disagree with what the query actually scopes to, which is how the chip and
 * the server drifted a season apart in the first place.
 *
 * @param {{ nfl_weeks: NflWeekIdentifier[] }} params
 * @returns {string}
 */
export const summarize_nfl_week_identifiers = ({ nfl_weeks }) => {
  if (!nfl_weeks || !nfl_weeks.length) return ''

  const groups = group_nfl_weeks({ nfl_weeks })
  const keys = Object.keys(groups)
  if (!keys.length) return ''

  const years = new Set()
  /** @type {string[]} */
  const seas_types = []
  for (const key of keys.sort(compare_nfl_week_group_keys)) {
    const [year, seas_type] = key.split('_')
    years.add(parseInt(year, 10))
    if (!seas_types.includes(seas_type)) seas_types.push(seas_type)
  }

  const sorted_years = [...years].sort((a, b) => a - b)
  const min = sorted_years[0]
  const max = sorted_years[sorted_years.length - 1]
  const year_label = min === max ? `${min}` : `${min}-${max}`

  return `${year_label} ${seas_types.join('/')}`
}

// Past this many weeks the exact enumeration stops being readable and the
// summary is what a chip or a notice wants. A `last_n_nfl_weeks` list (5 by
// default) stays exact even when it straddles a season boundary; a whole REG
// season or a multi-year span collapses.
const EXACT_LABEL_MAX_WEEKS = 12

/**
 * The one presentation of a resolved list, shared by the filter chip and the
 * client notice so they cannot describe the same value differently.
 *
 * @param {{ nfl_weeks: NflWeekIdentifier[] }} params
 * @returns {string}
 */
export const format_nfl_week_identifiers_label = ({ nfl_weeks }) => {
  if (!nfl_weeks || !nfl_weeks.length) return ''
  return nfl_weeks.length <= EXACT_LABEL_MAX_WEEKS
    ? format_nfl_week_param_values({ nfl_weeks })
    : summarize_nfl_week_identifiers({ nfl_weeks })
}
