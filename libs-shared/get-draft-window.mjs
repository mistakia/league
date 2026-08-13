import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import timestamptz_to_epoch from './timestamptz-to-epoch.mjs'
import get_paused_open_seconds from './get-paused-open-seconds.mjs'
import {
  DRAFT_TIMEZONE,
  HOURS_PER_DAY,
  is_open_hour,
  resolve_daily_window as resolve_band
} from './draft-daily-window.mjs'

// `getDraftWindow` is the surface that warns on a misconfigured band, since a
// silently widened window changes every placement on the board.
const resolve_daily_window = (bounds) => resolve_band({ ...bounds, warn: true })

dayjs.extend(utc)
dayjs.extend(timezone)

export { DRAFT_TIMEZONE }

export const CADENCE_UNITS = Object.freeze(['hour', 'day'])

export const DEFAULT_CADENCE_UNIT = 'hour'
export const DEFAULT_CADENCE_INTERVAL = 1

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
 *   window(pick_number) = reference advanced by one step per unmade pick between
 *
 * The reference is the selection time of the last pick MADE before this one, or
 * the draft start pre-draft (treated as the completion of a notional pick 0).
 * The immediate next unmade pick therefore opens at "now" — the instant the pick
 * before it landed — and each further unmade pick ahead of it adds a step.
 *
 * Counting unmade picks rather than pick numbers is what keeps the placement
 * honest once a pick has been taken out of order. A jumped pick is already made,
 * so it consumes no step, and the picks behind it measure from when that jump
 * actually landed rather than from the last gap-free pick at the top of the
 * board — which is a stale anchor the moment anybody jumps. It also absorbs a
 * board whose pick numbering has holes, which is what a decommissioned team's
 * removed pick leaves behind.
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
 * `draft_picks[].selection_timestamp` is timestamptz as of the 2026-08-07
 * conformance pass (`draft.selection_timestamp`) and is always DB-sourced, so it
 * is taken as an instant here rather than converted at each caller — the same
 * rule `getDraftDates` states for `last_selection_timestamp`.
 * `draft_start_timestamp` stays epoch seconds because this function does
 * arithmetic on it. Passing epoch seconds for a selection throws rather than
 * silently reading as 1970, which is the failure this convention exists to end.
 *
 * @param {Array} [args.draft_picks] - The WHOLE board, as `{ pick, pid,
 *   selection_timestamp }` rows in any order, the selection being a `Date` or ISO
 *   string. A pick counts as made when it carries a `pid`. Omit pre-draft. Passing
 *   a partial board undercounts the steps and so places the window too early.
 *
 * @param {Array} [args.draft_pause_periods] - League pause intervals as
 *   `{ paused_at, resumed_at }`, `resumed_at` null while a pause is open. Paused
 *   open time is credited back, so a team does not lose clock to a stretch it
 *   was forbidden from drafting in. INTERVALS rather than a scalar: the credit
 *   has to be clipped to pause time after this pick's own reference, and the
 *   reference is resolved in here, so no caller can do the clip. Passing a
 *   precomputed total instead charges every pick made after a resume for the
 *   whole pause, and that error compounds — each over-late window delays the
 *   selection that anchors the next pick.
 *
 * @param {import('dayjs').Dayjs|Date|string|number} [args.until] - The caller's
 *   now, the credit's upper clip bound. Defaults to the current time. An OPEN
 *   pause is measured to here, which is what freezes a pick's remaining time
 *   for the duration of a pause instead of letting it tick down.
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
 *   draft_picks: [{ pick: 8, pid: 'JOSH-ALLE-000001', selection_timestamp: '2026-08-25T18:40:00Z' }]
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
  draft_picks,
  draft_pause_periods,
  until
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
    draft_picks,
    pick_number
  })

  const reference = dayjs.unix(reference_timestamp).tz(DRAFT_TIMEZONE)

  let window_open_at = advance_to_open_hour(reference, daily_window)

  for (let step = 0; step < step_count; step++) {
    window_open_at = advance_one_step({
      window_open_at,
      cadence,
      daily_window
    })
  }

  return apply_pause_credit({
    window_open_at,
    reference,
    draft_pause_periods,
    until,
    cadence,
    daily_window
  })
}

/**
 * Shifts a placed window forward by the open time the league spent paused.
 *
 * Two decisions here, and both are load-bearing.
 *
 * The credit is CLIPPED to `[reference, until]`. Only pause time this pick
 * actually waited through counts: mid-draft the reference is the previous
 * selection's timestamp, so a pause that ended before it was already absorbed
 * by whoever was on the clock then. Crediting it anyway charges every later
 * pick the whole pause, and because each over-late window delays the selection
 * that anchors the pick behind it, the error compounds down the board rather
 * than staying a fixed offset.
 *
 * The credit is applied AFTER the step loop, not to the reference before it.
 * The two orderings are not equivalent: `advance_one_step` is hour-granular and
 * snaps to the top of the hour whenever a step crosses the overnight gap, so
 * feeding a credited anchor back through it truncates exactly the minutes the
 * open-seconds credit exists to preserve. Measured across anchors, step counts
 * and credit sizes on the live config, the two disagree in about 9% of cases by
 * up to 59 minutes, always shortening the team's clock. Stepping first and
 * crediting after shifts the unpaused schedule by the pause instead of
 * re-quantizing it.
 *
 * A `day` cadence is not credited at all. A day step holds its time of day
 * across the step, so open seconds and one step do not measure the same thing;
 * `get_paused_open_seconds` throws rather than return a number that would mean
 * something different than the caller assumes.
 */
function apply_pause_credit({
  window_open_at,
  reference,
  draft_pause_periods,
  until,
  cadence,
  daily_window
}) {
  if (!draft_pause_periods || !draft_pause_periods.length) {
    return window_open_at
  }

  if (cadence.unit === 'day') {
    return window_open_at
  }

  const upper_bound = until
    ? dayjs(until).tz(DRAFT_TIMEZONE)
    : dayjs().tz(DRAFT_TIMEZONE)

  const credit_seconds = get_paused_open_seconds({
    draft_pause_periods,
    from: reference,
    until: upper_bound,
    cadence_unit: cadence.unit,
    daily_window_start_hour: daily_window.start_hour,
    daily_window_end_hour: daily_window.end_hour
  })

  if (credit_seconds <= 0) return window_open_at

  return advance_open_seconds({
    time: window_open_at,
    seconds: credit_seconds,
    daily_window
  })
}

/**
 * Advances `time` by `seconds` of OPEN time, preserving minutes.
 *
 * Continuous rather than hour-by-hour: it consumes whatever remains of the
 * current day's band, then whole bands, then lands mid-band on the remainder.
 * A window derived from a real selection timestamp therefore keeps that
 * timestamp's minutes across the credit, which is the difference between a
 * correct pick clock and one up to 59 minutes short.
 */
function advance_open_seconds({ time, seconds, daily_window }) {
  let advanced = advance_to_open_hour(time, daily_window)
  let remaining = seconds

  // Each iteration consumes a full day's band, so this is bounded by the credit
  // divided by the band length and cannot spin.
  while (remaining > 0) {
    const band_close = advanced
      .hour(daily_window.end_hour)
      .minute(0)
      .second(0)
      .millisecond(0)

    const available = band_close.diff(advanced, 'second')

    if (remaining < available) {
      return advanced.add(remaining, 'second')
    }

    remaining -= available
    advanced = advanced
      .add(1, 'day')
      .hour(daily_window.start_hour)
      .minute(0)
      .second(0)
      .millisecond(0)
  }

  return advanced
}

/**
 * Resolves the timestamp to measure from and how many cadence steps past it the
 * requested pick sits.
 *
 * Mid-draft the reference is the last pick MADE before the requested one, and
 * the step count is how many picks are still UNMADE between the two; pre-draft,
 * or with nothing made ahead of it, the reference is the draft start, which
 * stands in for the completion of a notional pick 0.
 *
 * A pick is made when it carries a `pid`, but only a `selection_timestamp` can
 * anchor the measurement — the two come apart in the client, where the draft
 * reducer writes the `pid` onto a pick the instant a selection lands and the
 * timestamp arrives with the next load. Such a pick consumes no step and does
 * not become the anchor, so the window measures from the previous timestamped
 * selection until the board refreshes.
 */
function resolve_reference({
  draft_start_timestamp,
  draft_picks,
  pick_number
}) {
  const preceding_picks = (draft_picks ?? [])
    .filter((draft_pick) => draft_pick.pick < pick_number)
    .sort((a, b) => a.pick - b.pick)

  // A reverse loop rather than findLastIndex: this module is isomorphic and
  // reaches the SPA bundle, where preset-env transpiles syntax but leaves a
  // runtime array method to a polyfill that is not configured here.
  let reference_index = -1
  for (let index = preceding_picks.length - 1; index >= 0; index--) {
    if (preceding_picks[index].selection_timestamp) {
      reference_index = index
      break
    }
  }

  if (reference_index === -1) {
    return {
      reference_timestamp: draft_start_timestamp,
      // With no board at all every preceding pick is unmade by definition, which
      // is the pre-draft case the bare `pick_number` stands in for.
      step_count: preceding_picks.length || Math.max(pick_number - 1, 0)
    }
  }

  return {
    reference_timestamp: timestamptz_to_epoch(
      preceding_picks[reference_index].selection_timestamp
    ),
    step_count: preceding_picks
      .slice(reference_index + 1)
      .filter((draft_pick) => !draft_pick.pid).length
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
  { daily_window_start_hour, daily_window_end_hour } = {}
) => {
  const window = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour
  })
  const hour = time.hour()
  return is_open_hour(hour, window)
}

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
