// @ts-check
import { current_season } from '#constants'
import { get_max_weeks_for_season_type } from './nfl-week-identifier.mjs'

// ONE measure for what a dynamic `week` value means, feeding three
// presentations: the multi `week` param resolver, the `single_week` resolver,
// and the filter-chip label.
//
// It was three near-copies of the same switch, and they had already drifted in
// two separate places:
//
//   `current_week`  the multi param returned the RAW counter (0 through the
//                   offseason) while single_week returned Math.max(counter, 1),
//                   matching its own default_value. One token, two answers,
//                   with nothing in either name to say so. Clamping the multi
//                   one to match shipped a production regression and was
//                   reverted the same day -- not because the clamp was wrong,
//                   but because a CONSUMER was reading the falsy 0 as
//                   "season-long". That consumer now tests the column's
//                   declared grain instead, which is what makes convergence
//                   safe here.
//
//   `last_n_weeks`  the server floored at 0 and the header label floored at 1,
//                   so in the first weeks of a season the chip named a span the
//                   query did not select.
//
// Both disappear by construction now: the label is DERIVED from the resolved
// list rather than recomputed beside it, so a label that disagrees with its
// own resolution is no longer expressible.
//
// The floor is 1 and there is no way to ask for 0. Week 0 was a sentinel
// meaning "the whole season"; grain is carried by the column's own declaration,
// never by a magic value in a shared param.

/** The lowest week any dynamic may resolve to. Week 0 is not a week. */
export const MIN_WEEK = 1

const default_max_week = () =>
  get_max_weeks_for_season_type({
    seas_type: 'REG',
    year: current_season.year
  })

/**
 * @typedef {object} WeekDynamicArgs
 * @property {any} [value] the N of last_n_weeks / next_n_weeks
 * @property {number} [max_week] upper bound, defaulting to the current season's REG max
 */

// A keyed map rather than a switch, so WEEK_DYNAMIC_TYPES below is derived from
// it. Same reasoning as libs-shared/nfl-week-dynamic-values.mjs: a hand-kept
// list beside a switch can only disagree in the silent direction.
/** @type {Record<string, (args: WeekDynamicArgs) => number[]>} */
const WEEK_DYNAMIC_RESOLVERS = {
  // Descending, matching the order this resolver has always produced. The
  // caller de-duplicates; order reaches SQL only as an IN list.
  last_n_weeks: ({ value }) => {
    const n = parseInt(value || 3, 10)
    const end = current_season.active_fantasy_week
    return Array.from({ length: n }, (_, i) => Math.max(MIN_WEEK, end - i))
  },

  next_n_weeks: ({ value, max_week }) => {
    const n = parseInt(value || 3, 10)
    const start = current_season.active_fantasy_week
    const ceiling = max_week == null ? default_max_week() : max_week
    return Array.from({ length: n }, (_, i) => Math.min(ceiling, start + i + 1))
  },

  current_week: () => [current_season.active_fantasy_week]
}

/** The declared vocabulary, derived from the resolvers rather than restated. */
export const WEEK_DYNAMIC_TYPES = Object.keys(WEEK_DYNAMIC_RESOLVERS)

/**
 * Resolves one dynamic `week` value to the concrete week numbers it names.
 *
 * THROWS on an unrecognized type rather than answering an empty list, for the
 * same reason resolve_nfl_week_dynamic_value does: an unresolvable dynamic
 * contributes zero weeks while the param's PRESENCE still makes the column read
 * as explicitly time-scoped, which leaves the row axis unbounded. A confident
 * empty list is the one answer that cannot be distinguished from a correct one.
 *
 * @param {{ dynamic_type: string } & WeekDynamicArgs} args
 * @returns {number[]}
 */
export const resolve_week_dynamic_value = ({
  dynamic_type,
  value,
  max_week
}) => {
  const resolver = Object.prototype.hasOwnProperty.call(
    WEEK_DYNAMIC_RESOLVERS,
    dynamic_type
  )
    ? WEEK_DYNAMIC_RESOLVERS[dynamic_type]
    : null

  if (!resolver) {
    throw new Error(
      `resolve_week_dynamic_value: unknown dynamic_type "${dynamic_type}"`
    )
  }

  return resolver({ value, max_week })
}

/**
 * The filter-chip label for a dynamic week value -- `6` or `4-6`.
 *
 * DERIVED from the resolved list, never recomputed. This is the whole reason
 * the label and the server can no longer disagree about where a span starts.
 *
 * @param {{ dynamic_type: string } & WeekDynamicArgs} args
 * @returns {string}
 */
export const format_week_dynamic_label = (args) => {
  const weeks = resolve_week_dynamic_value(args)
  if (!weeks.length) return ''
  const start = Math.min(...weeks)
  const end = Math.max(...weeks)
  return start === end ? `${end}` : `${start}-${end}`
}
