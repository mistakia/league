import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import getDraftWindow, { DRAFT_TIMEZONE } from './get-draft-window.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

const WAIVER_HOURS_AFTER_COMPLETION = 24

/**
 * Calculates when the draft closes and when the post-draft waiver period on
 * undrafted rookies ends.
 *
 * `draftEnd` is a hard cutoff: the draft route refuses selections past it, so
 * any pick still unmade is forfeited and its rookies fall to practice-squad
 * waivers. It is derived from the same cadence as the individual windows —
 * the end of the day the pick *after* the last one would have opened.
 *
 * @param {Object} args
 * @param {number} args.draft_start_timestamp - Unix timestamp (seconds) the draft opens.
 * @param {number} args.total_picks - Number of picks in the draft.
 * @param {string} [args.cadence_unit] - 'hour' or 'day'; what one step is measured in.
 * @param {number} [args.cadence_interval] - Units of `cadence_unit` between consecutive windows.
 * @param {number} [args.daily_window_start_hour] - First hour a window may open (inclusive).
 * @param {number} [args.daily_window_end_hour] - Hour windows stop opening (exclusive).
 * @param {number} [args.last_selection_timestamp] - Selection time of the final pick, once made.
 * @param {number} [args.rookie_draft_completed_at] - Explicit completion timestamp, if recorded.
 *
 * @returns {{ draftEnd: import('dayjs').Dayjs, waiverEnd: import('dayjs').Dayjs }}
 */
export default function getDraftDates({
  draft_start_timestamp,
  total_picks,
  cadence_unit,
  cadence_interval,
  daily_window_start_hour,
  daily_window_end_hour,
  last_selection_timestamp,
  rookie_draft_completed_at
}) {
  // An explicit completion timestamp is authoritative — it records that the
  // draft actually ended, rather than projecting when it would have.
  if (rookie_draft_completed_at) {
    const draftEnd = dayjs.unix(rookie_draft_completed_at).tz(DRAFT_TIMEZONE)
    const waiverEnd = draftEnd
      .add(WAIVER_HOURS_AFTER_COMPLETION, 'hours')
      .endOf('day')

    return { draftEnd, waiverEnd }
  }

  // A league with no picks on the board has nothing to project past, so the
  // draft closes at the end of the day its first window would have opened.
  // Guarding here keeps a missing count from reaching getDraftWindow as NaN.
  const has_picks = Number.isInteger(total_picks) && total_picks > 0
  const window_after_last_pick = has_picks ? total_picks + 1 : 1

  const final_window = last_selection_timestamp
    ? dayjs.unix(last_selection_timestamp).tz(DRAFT_TIMEZONE)
    : getDraftWindow({
        draft_start_timestamp,
        pick_number: window_after_last_pick,
        cadence_unit,
        cadence_interval,
        daily_window_start_hour,
        daily_window_end_hour
      })

  const draftEnd = final_window.endOf('day')
  const waiverEnd = draftEnd.add(1, 'day')

  return { draftEnd, waiverEnd }
}
