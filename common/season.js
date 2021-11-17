import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isBetween from 'dayjs/plugin/isBetween'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isBetween)

const getEstOffset = () => {
  const stdTimezoneOffset = () => {
    const jan = new Date(0, 1)
    const jul = new Date(6, 1)
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())
  }

  const today = new Date()

  const isDstObserved = (Date) => {
    return today.getTimezoneOffset() < stdTimezoneOffset()
  }

  if (isDstObserved(today)) {
    return -4
  } else {
    return -5
  }
}

export default class Season {
  constructor() {
    this.offseason = dayjs
      .tz('2021-02-07', 'America/New_York')
      .utc()
      .utcOffset(-5) // Super Bowl
    this.start = dayjs.tz('2021-08-31', 'America/New_York').utc().utcOffset(-4) // Two Tuesdays before first game
    this.end = dayjs.tz('2022-02-06', 'America/New_York').utc().utcOffset(-5) // super bowl
    this.openingDay = dayjs
      .tz('2021-09-09', 'America/New_York')
      .utc()
      .utcOffset(-4) // first game
    this.finalWeek = 17
    this.nflFinalWeek = 18
  }

  get now() {
    const offset = getEstOffset()
    return dayjs().utc().utcOffset(offset)
  }

  get isOffseason() {
    return this.week === 0
  }

  get isRegularSeason() {
    const week = this.week
    return week > 0 && week <= this.finalWeek
  }

  get isWaiverPeriod() {
    if (!this.isRegularSeason) {
      return true
    }

    const now = this.now
    if (now.day() === 2) {
      // is Tuesday
      return true
    }

    if (now.day() === 3 && now.hour() < 15) {
      // is Wednesday before 3PM
      return true
    }

    return false
  }

  get week() {
    const diff = this.now.diff(this.start, 'weeks')
    return diff < 0 ? 0 : diff
  }

  get year() {
    const now = this.now
    return now.isBefore(this.end) ? this.start.year() : this.end.year()
  }
}
