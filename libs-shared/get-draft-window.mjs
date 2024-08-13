import dayjs from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)
dayjs.extend(utc)
dayjs.extend(timezone)

export default function getDraftWindow({
  start,
  min = 11,
  max = 16,
  pickNum,
  type = 'hour',
  last_consecutive_pick
}) {
  if (type === null) {
    type = 'hour'
  }

  if (min === null) {
    min = 11
  }

  if (max === null) {
    max = 16
  }

  let clockStart

  if (type === 'day' && last_consecutive_pick) {
    const pick_diff = pickNum - last_consecutive_pick.pick

    if (pick_diff === 1) {
      // For the immediate next pick, use the timestamp of the last consecutive pick
      clockStart = dayjs
        .unix(last_consecutive_pick.selection_timestamp)
        .tz('America/New_York')
    } else {
      // For subsequent picks, use the midnight-based logic
      clockStart = dayjs
        .unix(last_consecutive_pick.selection_timestamp)
        .tz('America/New_York')
      const next_midnight = clockStart.add(1, 'day').startOf('day')

      // Ensure the window is at least 24 hours
      if (next_midnight.diff(clockStart, 'hours') < 24) {
        clockStart = next_midnight.add(1, 'day')
      } else {
        clockStart = next_midnight
      }

      if (pick_diff > 2) {
        clockStart = clockStart.add(pick_diff - 2, 'day')
      }
    }
  } else {
    clockStart = dayjs.unix(start).tz('America/New_York').startOf('day')
    const isValid = (time) =>
      time.isSameOrAfter(time.hour(min)) && time.isSameOrBefore(time.hour(max))

    while (!isValid(clockStart)) {
      clockStart = clockStart.add(1, type)
    }

    for (let i = 1; i < pickNum; i++) {
      clockStart = clockStart.add(1, type)
      while (!isValid(clockStart)) {
        clockStart = clockStart.add(1, type)
      }
    }
  }

  return clockStart
}
