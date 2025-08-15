import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import getDraftWindow from './get-draft-window.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

export default function getDraftDates({
  start,
  min = 11,
  max = 16,
  picks,
  type = 'hour',
  last_selection_timestamp,
  rookie_draft_completed_at
}) {
  // Prioritize explicit completion timestamp when available
  if (rookie_draft_completed_at) {
    const draftEnd = dayjs
      .unix(rookie_draft_completed_at)
      .tz('America/New_York')
    // Calculate the first midnight that is at least 24 hours after completion
    const minimum_waiver_time = draftEnd.add(24, 'hours')
    const waiverEnd = minimum_waiver_time.endOf('day')
    return {
      draftEnd,
      waiverEnd
    }
  }

  // Fallback to existing calculation logic
  const last_pick_window_end = last_selection_timestamp
    ? dayjs.unix(last_selection_timestamp).tz('America/New_York')
    : getDraftWindow({
        start,
        min,
        max,
        pickNum: picks + 1,
        type
      })

  const draftEnd = last_pick_window_end.endOf('day')
  const waiverEnd = draftEnd.add(1, 'day')
  return {
    draftEnd,
    waiverEnd
  }
}
