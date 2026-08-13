import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import timestamptz_to_epoch from './timestamptz-to-epoch.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

export const DRAFT_TIMEZONE = 'America/New_York'

export const CADENCE_UNITS = Object.freeze(['hour', 'day'])

export const DEFAULT_CADENCE_UNIT = 'hour'
export const DEFAULT_CADENCE_INTERVAL = 1
export const DEFAULT_DAILY_WINDOW_START_HOUR = 11
export const DEFAULT_DAILY_WINDOW_END_HOUR = 16

const FIRST_HOUR_OF_DAY = 0
const HOURS_PER_DAY = 24

/**
 * Calculates when a given pick's draft window opens.
 *
 * A pick's window is the moment that pick becomes eligible to be taken *out of
 * order* — when its team may select even though an earlier pick is still
 * unmade. A team whose preceding pick has already been made is always on the
 * clock regardless of the window; the window only governs jumping a stalled
 * team ahead of you.
 *
 * The rule, shared by every cadence:
 *
 *   window(pick_number) = reference advanced by (pick_number - reference_pick - 1) steps
 *
 * The reference is the last consecutively-made pick's selection time, or the
 * draft start pre-draft (treated as the completion of a notional pick 0). The
 * immediate next unmade pick therefore opens at "now" — the instant the pick
 * before it landed — and each subsequent pick opens one step later.
 *
 * A step is `cadence_interval` units of `cadence_unit`, and every step lands on
 * an hour inside the daily window `[daily_window_start_hour,
 * daily_window_end_hour)`; hours outside it are skipped. The two units differ
 * in more than scale: `hour` steps consume open slots and so skip the overnight
 * gap, while `day` steps hold the time of day across the step.
 *
 * @param {Object} args
 * @param {number} args.draft_start_timestamp - Unix timestamp (seconds) the draft opens.
 * @param {number} args.pick_number - 1-based pick number to calculate the window for.
 * @param {string} [args.cadence_unit='hour'] - 'hour' or 'day'; what one step is measured in.
 * @param {number} [args.cadence_interval=1] - Units of `cadence_unit` between consecutive windows.
 * @param {number} [args.daily_window_start_hour=11] - First hour of the day a window may open (inclusive).
 * @param {number} [args.daily_window_end_hour=16] - Hour of the day windows stop opening (EXCLUSIVE).
 * `last_consecutive_pick.selection_timestamp` is timestamptz as of the
 * 2026-08-07 conformance pass (`draft.selection_timestamp`) and is always
 * DB-sourced, so it is taken as an instant here rather than converted at each
 * caller — the same rule `getDraftDates` states for `last_selection_timestamp`.
 * `draft_start_timestamp` stays epoch seconds because this function does
 * arithmetic on it. Passing epoch seconds for the selection throws rather than
 * silently reading as 1970, which is the failure this convention exists to end.
 *
 * @param {Object} [args.last_consecutive_pick] - `{ pick, selection_timestamp }` of the last
 *   pick made with no gap behind it, the selection being a `Date` or ISO string. Omit pre-draft.
 *
 * @returns {import('dayjs').Dayjs} The moment the pick's window opens.
 *
 * @example
 * // Pre-draft, hourly, windows open 9am through 9pm Eastern
 * getDraftWindow({
 *   draft_start_timestamp: 1787371200,
 *   pick_number: 5,
 *   cadence_unit: 'hour',
 *   daily_window_start_hour: 9,
 *   daily_window_end_hour: 22
 * })
 *
 * @example
 * // Mid-draft: pick 9 is the immediate next pick, so its window is already open
 * getDraftWindow({
 *   draft_start_timestamp: 1787371200,
 *   pick_number: 9,
 *   last_consecutive_pick: { pick: 8, selection_timestamp: '2026-08-25T18:40:00Z' }
 * })
 *
 * @example
 * // Every other day, same time of day each step
 * getDraftWindow({
 *   draft_start_timestamp: 1787371200,
 *   pick_number: 4,
 *   cadence_unit: 'day',
 *   cadence_interval: 2
 * })
 */
export default function getDraftWindow({
  draft_start_timestamp,
  pick_number,
  cadence_unit,
  cadence_interval,
  daily_window_start_hour,
  daily_window_end_hour,
  last_consecutive_pick
}) {
  const cadence = resolve_cadence({ cadence_unit, cadence_interval })
  const daily_window = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour
  })

  if (!Number.isFinite(pick_number) || pick_number <= 0) {
    console.warn('[getDraftWindow] Invalid pick_number:', pick_number)
    return dayjs.unix(draft_start_timestamp).tz(DRAFT_TIMEZONE)
  }

  const { reference_timestamp, step_count } = resolve_reference({
    draft_start_timestamp,
    last_consecutive_pick,
    pick_number
  })

  let window_open_at = advance_to_open_hour(
    dayjs.unix(reference_timestamp).tz(DRAFT_TIMEZONE),
    daily_window
  )

  for (let step = 0; step < step_count; step++) {
    window_open_at = advance_one_step({
      window_open_at,
      cadence,
      daily_window
    })
  }

  return window_open_at
}

/**
 * Resolves the timestamp to measure from and how many cadence steps past it the
 * requested pick sits.
 *
 * Mid-draft the reference is the last consecutively-made pick; pre-draft it is
 * the draft start, which stands in for the completion of a notional pick 0.
 */
function resolve_reference({
  draft_start_timestamp,
  last_consecutive_pick,
  pick_number
}) {
  if (last_consecutive_pick && last_consecutive_pick.selection_timestamp) {
    const picks_ahead = pick_number - last_consecutive_pick.pick

    if (picks_ahead > 0) {
      return {
        reference_timestamp: timestamptz_to_epoch(
          last_consecutive_pick.selection_timestamp
        ),
        step_count: picks_ahead - 1
      }
    }

    // A pick at or behind the last consecutive pick means the caller's view of
    // the draft is inconsistent (or the pick is already made). Measuring from
    // the reference would place the window behind it, so fall back to the
    // pre-draft calculation.
    console.warn(
      '[getDraftWindow] pick_number',
      pick_number,
      'is not ahead of last_consecutive_pick',
      last_consecutive_pick.pick,
      '- measuring from the draft start instead'
    )
  }

  return {
    reference_timestamp: draft_start_timestamp,
    step_count: pick_number - 1
  }
}

/**
 * Validates the cadence, falling back to the default rather than silently
 * accepting a unit the caller misspelled.
 */
function resolve_cadence({ cadence_unit, cadence_interval }) {
  let unit = cadence_unit ?? DEFAULT_CADENCE_UNIT
  let interval = cadence_interval ?? DEFAULT_CADENCE_INTERVAL

  if (!CADENCE_UNITS.includes(unit)) {
    console.warn(
      '[getDraftWindow] Unrecognized cadence_unit:',
      cadence_unit,
      `- falling back to '${DEFAULT_CADENCE_UNIT}'`
    )
    unit = DEFAULT_CADENCE_UNIT
  }

  if (!Number.isInteger(interval) || interval < 1) {
    console.warn(
      '[getDraftWindow] Invalid cadence_interval:',
      cadence_interval,
      `- falling back to ${DEFAULT_CADENCE_INTERVAL}`
    )
    interval = DEFAULT_CADENCE_INTERVAL
  }

  return { unit, interval }
}

/**
 * Coerces the daily window to a usable half-open hour interval.
 *
 * `end_hour` is exclusive, so `[0, 24)` means every hour is open and
 * `[9, 22)` opens thirteen slots a day (09:00 through 21:00). An empty or
 * inverted interval would leave no hour to advance to, so it is widened to the
 * whole day rather than left to strand the caller.
 */
function resolve_daily_window({
  daily_window_start_hour,
  daily_window_end_hour
}) {
  const start_hour = daily_window_start_hour ?? DEFAULT_DAILY_WINDOW_START_HOUR
  const end_hour = daily_window_end_hour ?? DEFAULT_DAILY_WINDOW_END_HOUR

  const is_usable =
    Number.isInteger(start_hour) &&
    Number.isInteger(end_hour) &&
    start_hour >= FIRST_HOUR_OF_DAY &&
    end_hour <= HOURS_PER_DAY &&
    start_hour < end_hour

  if (!is_usable) {
    console.warn(
      '[getDraftWindow] Invalid daily window:',
      { daily_window_start_hour, daily_window_end_hour },
      `- falling back to [${FIRST_HOUR_OF_DAY}, ${HOURS_PER_DAY})`
    )
    return { start_hour: FIRST_HOUR_OF_DAY, end_hour: HOURS_PER_DAY }
  }

  return { start_hour, end_hour }
}

/**
 * Whether `time` falls inside the daily window `[start_hour, end_hour)`.
 *
 * Resolves the daily window the same way `getDraftWindow` does, so the gate
 * matches the placement window, including the default for null/missing bounds.
 * A time's hour of day is compared in the draft timezone — `current_season.now`
 * is already Eastern, so passing it directly is correct.
 *
 * @param {import('dayjs').Dayjs} time - A Dayjs instance in the draft timezone.
 * @param {Object} [args]
 * @param {number} [args.daily_window_start_hour]
 * @param {number} [args.daily_window_end_hour]
 * @returns {boolean} True when `time.hour()` is an open hour.
 */
export const is_within_daily_window = (
  time,
  { daily_window_start_hour, daily_window_end_hour }
) => {
  const window = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour
  })
  const hour = time.hour()
  return is_open_hour(hour, window)
}

const is_open_hour = (hour, { start_hour, end_hour }) =>
  hour >= start_hour && hour < end_hour

/**
 * Advances one cadence step, landing on an open hour.
 *
 * An `hour` step consumes open slots, so a step taken at the end of the day
 * lands on the next morning. A `day` step holds the time of day, which is
 * already open, so the skip is a no-op.
 */
function advance_one_step({ window_open_at, cadence, daily_window }) {
  let advanced = window_open_at

  for (let unit = 0; unit < cadence.interval; unit++) {
    advanced = advance_to_open_hour(advanced.add(1, cadence.unit), daily_window)
  }

  return advanced
}

/**
 * Rolls forward to the next hour inside the daily window.
 *
 * A time already inside the window is returned untouched, so a window derived
 * from a real selection timestamp keeps that timestamp's minutes instead of
 * being rounded away. A time outside it snaps to the top of the destination
 * hour, since that destination is a slot boundary rather than an event.
 *
 * Bounded by the length of a day: a non-empty daily window always has a
 * qualifying hour within the next 24, so this cannot spin.
 */
function advance_to_open_hour(time, daily_window) {
  if (is_open_hour(time.hour(), daily_window)) {
    return time
  }

  let candidate = time.startOf('hour')
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    candidate = candidate.add(1, 'hour')
    if (is_open_hour(candidate.hour(), daily_window)) {
      return candidate
    }
  }

  return candidate
}
