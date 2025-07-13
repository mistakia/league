import dayjs from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)
dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * Calculates the draft window start time for a given pick in a fantasy league draft.
 *
 * @param {Object} args - The arguments object.
 * @param {number} args.start - Unix timestamp (seconds) for the draft start time.
 * @param {number} [args.min=11] - Earliest hour of the day when a pick window can start.
 * @param {number} [args.max=16] - Latest hour of the day when a pick window can start.
 * @param {number} args.pickNum - The pick number (1-based) for which to calculate the window.
 * @param {string} [args.type='hour'] - 'hour' or 'day'. Window duration type.
 * @param {Object} [args.last_consecutive_pick] - Last consecutive pick made { pick, selection_timestamp }.
 *
 * @returns {import('dayjs').Dayjs} Start time of the draft window for the given pick.
 *
 * @example
 * // Pre-draft: Calculate window for pick 5 in hourly draft
 * getDraftWindow({ start: 1625130000, pickNum: 5, type: 'hour' })
 *
 * @example
 * // Mid-draft: Calculate window for pick 10 with last consecutive pick
 * getDraftWindow({
 *   start: 1625130000,
 *   pickNum: 10,
 *   type: 'day',
 *   last_consecutive_pick: { pick: 8, selection_timestamp: 1625133600 }
 * })
 */
export default function getDraftWindow({
  start,
  min = 11,
  max = 16,
  pickNum,
  type = 'hour',
  last_consecutive_pick
}) {
  // Normalize null values
  if (type === null) type = 'hour'
  if (min === null) min = 11
  if (max === null) max = 16

  // Guard against invalid pick numbers
  if (pickNum <= 0) {
    console.warn('[getDraftWindow] Invalid pickNum:', pickNum)
    return dayjs.unix(start).tz('America/New_York')
  }

  // Determine the reference timestamp to calculate from
  const reference_timestamp = getReferenceTimestamp(
    start,
    last_consecutive_pick,
    pickNum
  )

  let window_start

  if (type === 'day') {
    window_start = calculateDailyWindow(
      reference_timestamp,
      pickNum,
      last_consecutive_pick,
      min,
      max
    )
  } else {
    window_start = calculateHourlyWindow(reference_timestamp, pickNum, min, max)
  }

  return window_start
}

/**
 * Determines the reference timestamp to calculate the draft window from.
 * Uses last_consecutive_pick if available, otherwise uses draft start.
 */
function getReferenceTimestamp(start, last_consecutive_pick, pickNum) {
  if (last_consecutive_pick && last_consecutive_pick.selection_timestamp) {
    const pick_diff = pickNum - last_consecutive_pick.pick

    // If pick_diff is 0 or negative, we're likely in a pre-draft or error state
    if (pick_diff <= 0) {
      console.warn(
        '[getDraftWindow] Invalid pick_diff:',
        pick_diff,
        'falling back to start'
      )
      return start
    }

    return last_consecutive_pick.selection_timestamp
  }

  return start
}

/**
 * Calculates the window start for daily draft windows.
 */
function calculateDailyWindow(
  reference_timestamp,
  pickNum,
  last_consecutive_pick,
  min,
  max
) {
  let window_start = dayjs.unix(reference_timestamp).tz('America/New_York')

  if (last_consecutive_pick && last_consecutive_pick.selection_timestamp) {
    const pick_diff = pickNum - last_consecutive_pick.pick

    if (pick_diff === 1) {
      // Immediate next pick - use the last pick's timestamp
      return window_start
    }

    // For subsequent picks, advance to next valid day(s)
    const next_midnight = window_start.add(1, 'day').startOf('day')

    // Ensure at least 24 hours from last pick
    if (next_midnight.diff(window_start, 'hours') < 24) {
      window_start = next_midnight.add(1, 'day')
    } else {
      window_start = next_midnight
    }

    // Add additional days for picks beyond the immediate next
    if (pick_diff > 2) {
      window_start = window_start.add(pick_diff - 2, 'day')
    }
  } else {
    // Pre-draft calculation: start from draft start and advance by pick number
    window_start = window_start.startOf('day')

    // Ensure we start within valid hours
    window_start = ensureValidHours(window_start, min, max, 'day')

    // Advance by pick number - 1 (since pick 1 starts at the draft start)
    for (let i = 1; i < pickNum; i++) {
      window_start = window_start.add(1, 'day')
      window_start = ensureValidHours(window_start, min, max, 'day')
    }
  }

  return window_start
}

/**
 * Calculates the window start for hourly draft windows.
 */
function calculateHourlyWindow(reference_timestamp, pickNum, min, max) {
  let window_start = dayjs
    .unix(reference_timestamp)
    .tz('America/New_York')
    .startOf('day')

  // Ensure we start within valid hours
  window_start = ensureValidHours(window_start, min, max, 'hour')

  // Advance by pick number - 1 (since pick 1 starts at the draft start)
  for (let i = 1; i < pickNum; i++) {
    window_start = window_start.add(1, 'hour')
    window_start = ensureValidHours(window_start, min, max, 'hour')
  }

  return window_start
}

/**
 * Ensures the given time falls within valid hours (min-max).
 * If not, advances to the next valid time slot.
 */
function ensureValidHours(time, min, max, increment_type) {
  const is_valid = (t) =>
    t.isSameOrAfter(t.hour(min)) && t.isSameOrBefore(t.hour(max))

  while (!is_valid(time)) {
    time = time.add(1, increment_type)
  }

  return time
}
