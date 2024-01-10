import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import isBetween from 'dayjs/plugin/isBetween.js'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isBetween)

const getEstOffset = (datetime = new Date()) => {
  const stdTimezoneOffset = () => {
    const jan = new Date(0, 1)
    const jul = new Date(6, 1)
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())
  }

  const isDstObserved = (Date) => {
    return datetime.getTimezoneOffset() < stdTimezoneOffset()
  }

  if (isDstObserved(datetime)) {
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
    wildcardWeek,
    now
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

    if (now) {
      const d = dayjs.unix(now)
      const offset = getEstOffset(d.toDate())
      this._now = d.utc().utcOffset(offset)
    }
  }

  get now() {
    if (this._now) return this._now
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

  get fantasy_season_week() {
    if (this.now < this.start) {
      return 0
    }

    if (this.now > this.end) {
      return 0
    }

    return this.week
  }

  get week() {
    const diff = Math.max(0, this.now.diff(this.start, 'weeks'))
    return diff
  }

  // will detect seas_type and return week number for that seas_type
  // POST and REG seas_type starts at 1
  // PRE seas_type starts at 0
  calculate_week(dayjs_date) {
    const diff = Math.max(0, dayjs_date.diff(this.start, 'weeks'))
    let seas_type = 'PRE'
    let week_number = 0

    if (diff <= 0) {
      throw new Error('Date is before season start')
      // TODO use a variable to determine start and number of preseason weeks
      // seas_type = 'PRE'
      // week_number = diff + 4
    } else if (diff > this.nflFinalWeek) {
      seas_type = 'POST'
      week_number = diff - this.nflFinalWeek
    } else {
      seas_type = 'REG'
      week_number = diff
    }

    return { seas_type, week: week_number }
  }

  get week_end() {
    const week = this.week
    return this.start.add(week + 1, 'weeks')
  }

  get year() {
    const now = this.now
    return now.isBefore(this.end) ? this.start.year() : this.end.year()
  }

  get nfl_seas_type() {
    const week = this.week

    if (week === 0) {
      return 'PRE'
    } else if (week > this.nflFinalWeek) {
      return 'POST'
    } else {
      return 'REG'
    }
  }

  get nfl_seas_week() {
    const week = this.now.diff(this.start, 'weeks')

    if (week < 1) {
      if (week <= -3) {
        return 0
      } else if (week === -2) {
        return 1
      } else if (week === -1) {
        return 2
      } else {
        return 3
      }
    } else if (week > this.nflFinalWeek) {
      return week - this.nflFinalWeek
    } else {
      return week
    }
  }
}
