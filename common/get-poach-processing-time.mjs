import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween.js'
import * as constants from './constants.mjs'

dayjs.extend(isBetween)

export default function (submitted) {
  const submitted_timestamp = dayjs.unix(submitted)
  if (constants.season.isOffseason) {
    return submitted_timestamp.add('48', 'hours')
  }

  // if submitted between thursday 6pm and sunday 3pm — set to tuesday at 3pm
  const { now } = constants.season
  const start_window = (
    now.day() < 3 ? now.subtract('1', 'week').day(5) : now.day(5)
  )
    .startOf('day')
    .hour(18)
  const end_window = (now.day() < 3 ? now.day(0) : now.add('1', 'week').day(0))
    .startOf('day')
    .hour(15)

  if (submitted_timestamp.isBetween(start_window, end_window)) {
    return (now.day() < 3 ? now.day(2) : now.add('1', 'week').day(2))
      .startOf('day')
      .hour(15)
  } else {
    // otherwise add 48 hours
    return submitted_timestamp.add('48', 'hours')
  }
}
