import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const TIMEZONE = 'America/New_York'

const DEFAULT_MIN_HOUR = 11
const DEFAULT_MAX_HOUR = 16
const DEFAULT_TYPE = 'hour'

/**
 * Calculates the draft window start time for a given pick in a fantasy league draft.
 *
 * A pick's window is the moment that pick becomes eligible to be taken *out of
 * order* — i.e. when its team may select even though an earlier pick is still
 * unmade. A team whose previous pick has already been made is always on the
 * clock regardless of the window; the window only governs jumping a stalled
 * team ahead of you.
 *
 * Semantics:
 *
 *   window(pickNum) = reference advanced by (pickNum - reference_pick - 1) steps
 *
 * where the reference is the last consecutively-made pick's selection time
 * (mid-draft) or the draft start (pre-draft, treated as the completion of a
 * notional pick 0). The immediate next unmade pick therefore has a window of
 * "now" — it opened the instant the pick before it was made — and each
 * subsequent pick opens one cadence step later.
 *
 * A step is one hour (`type = 'hour'`) or one day (`type = 'day'`). Steps only
 * ever land on an hour of the day within the half-open interval
 * `[min, max)`; hours outside it are skipped. `max` is EXCLUSIVE, so
 * `min = 0, max = 24` means every hour is valid and `min = 9, max = 22` gives
 * thirteen slots per day (09:00 through 21:00 inclusive).
 *
 * @param {Object} args - The arguments object.
 * @param {number} args.start - Unix timestamp (seconds) for the draft start time.
 * @param {number} [args.min=11] - First valid hour of the day (inclusive).
 * @param {number} [args.max=16] - First invalid hour of the day (exclusive).
 * @param {number} args.pickNum - The pick number (1-based) for which to calculate the window.
 * @param {string} [args.type='hour'] - 'hour' or 'day'. Cadence between consecutive picks.
 * @param {Object} [args.last_consecutive_pick] - Last consecutive pick made { pick, selection_timestamp }.
 *
 * @returns {import('dayjs').Dayjs} Start time of the draft window for the given pick.
 *
 * @example
 * // Pre-draft: window for pick 5 in an hourly draft
 * getDraftWindow({ start: 1625130000, pickNum: 5, type: 'hour' })
 *
 * @example
 * // Mid-draft: pick 9 is the immediate next pick, so its window is already open
 * getDraftWindow({
 *   start: 1625130000,
 *   pickNum: 9,
 *   type: 'day',
 *   last_consecutive_pick: { pick: 8, selection_timestamp: 1625133600 }
 * })
 */
export default function getDraftWindow({
  start,
  min = DEFAULT_MIN_HOUR,
  max = DEFAULT_MAX_HOUR,
  pickNum,
  type = DEFAULT_TYPE,
  last_consecutive_pick
}) {
  // Normalize null values — callers pass league columns straight through and
  // those are nullable.
  if (type === null || type === undefined) type = DEFAULT_TYPE
  if (min === null || min === undefined) min = DEFAULT_MIN_HOUR
  if (max === null || max === undefined) max = DEFAULT_MAX_HOUR
  ;[min, max] = normalize_hour_bounds(min, max)

  // Guard against invalid pick numbers
  if (pickNum <= 0) {
    console.warn('[getDraftWindow] Invalid pickNum:', pickNum)
    return dayjs.unix(start).tz(TIMEZONE)
  }

  const { reference_timestamp, steps } = get_reference(
    start,
    last_consecutive_pick,
    pickNum
  )

  const unit = type === 'day' ? 'day' : 'hour'

  let window_start = advance_to_valid_hour(
    dayjs.unix(reference_timestamp).tz(TIMEZONE),
    min,
    max
  )

  for (let i = 0; i < steps; i++) {
    window_start = advance_to_valid_hour(window_start.add(1, unit), min, max)
  }

  return window_start
}

/**
 * Resolves the timestamp to measure from and how many cadence steps past it
 * the requested pick sits.
 *
 * Mid-draft the reference is the last consecutively-made pick; pre-draft it is
 * the draft start, which stands in for the completion of a notional pick 0.
 */
function get_reference(start, last_consecutive_pick, pickNum) {
  if (last_consecutive_pick && last_consecutive_pick.selection_timestamp) {
    const pick_diff = pickNum - last_consecutive_pick.pick

    if (pick_diff > 0) {
      return {
        reference_timestamp: last_consecutive_pick.selection_timestamp,
        steps: pick_diff - 1
      }
    }

    // Asking for a pick at or behind the last consecutive pick means the
    // caller's view of the draft is inconsistent (or the pick is already
    // made). Fall back to the pre-draft calculation.
    console.warn(
      '[getDraftWindow] Invalid pick_diff:',
      pick_diff,
      'falling back to start'
    )
  }

  return { reference_timestamp: start, steps: pickNum - 1 }
}

/**
 * Coerces the hour bounds to a usable half-open interval within [0, 24].
 *
 * An empty or inverted interval would leave no valid hour to advance to, so it
 * is rejected in favor of "every hour is valid" rather than left to strand the
 * caller.
 */
function normalize_hour_bounds(min, max) {
  const valid =
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min >= 0 &&
    max <= 24 &&
    min < max

  if (!valid) {
    console.warn(
      '[getDraftWindow] Invalid hour bounds:',
      { min, max },
      'falling back to [0, 24)'
    )
    return [0, 24]
  }

  return [min, max]
}

const is_valid_hour = (hour, min, max) => hour >= min && hour < max

/**
 * Rolls forward to the next hour of the day within [min, max).
 *
 * Returns the time untouched when it is already valid, so a window derived
 * from a real selection timestamp keeps that timestamp's minutes rather than
 * being rounded away. When it does have to move it snaps to the top of the
 * hour, since the destination is a slot boundary rather than an event.
 *
 * Bounded at 24 iterations: with a non-empty [min, max) some hour of the next
 * day always qualifies, so this cannot spin.
 */
function advance_to_valid_hour(time, min, max) {
  if (is_valid_hour(time.hour(), min, max)) {
    return time
  }

  let candidate = time.startOf('hour')
  for (let i = 0; i < 24; i++) {
    candidate = candidate.add(1, 'hour')
    if (is_valid_hour(candidate.hour(), min, max)) {
      return candidate
    }
  }

  return candidate
}
