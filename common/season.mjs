import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import isBetween from 'dayjs/plugin/isBetween.js'
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
  constructor({
    offseason,
    start,
    end,
    openingDay,
    finalWeek,
    nflFinalWeek,
    regularSeasonFinalWeek,
    wildcardWeek
  }) {
    // Super Bowl
    this.offseason = dayjs.unix(offseason).utc().utcOffset(-5)

    // Two Tuesdays before first game
    this.start = dayjs.unix(start).utc().utcOffset(-4)

    // super bowl
    this.end = dayjs.unix(end).utc().utcOffset(-5)

    // first game
    this.openingDay = dayjs.unix(openingDay).utc().utcOffset(-4)

    this.finalWeek = finalWeek
    this.nflFinalWeek = nflFinalWeek
    this.regularSeasonFinalWeek = regularSeasonFinalWeek
    this.wildcardWeek = wildcardWeek
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
    return week > 0
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
    const diff = Math.max(0, this.now.diff(this.start, 'weeks'))
    const isOffseason = diff > this.finalWeek
    return isOffseason ? 0 : diff
  }

  get year() {
    const now = this.now
    return now.isBefore(this.end) ? this.start.year() : this.end.year()
  }
}
