import dayjs from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'

dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)

// TODO - set timezone

export default function getDraftWindow({
  start,
  min = 11,
  max = 16,
  pickNum,
  type = 'hour'
}) {
  let clockStart = dayjs.unix(start).startOf('day')
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

  return clockStart
}
