import moment from 'moment-timezone'

export default class Season {
  constructor () {
    this.offseason = moment.tz('2020-02-02', 'America/New_York') // Super Bowl
    this.start = moment.tz('2020-09-01', 'America/New_York') // Two Tuesdays before first game
    this.end = moment.tz('2021-02-07', 'America/New_York') // super bowl
    this.openingDay = moment.tz('2020-09-10', 'America/New_York') // first game
    this.finalWeek = 16
    this.nflFinalWeek = 17
  }

  get now () {
    return moment.tz('America/New_York')
  }

  get isRegularSeason () {
    const week = this.week
    return week > 0 && week <= this.finalWeek
  }

  get isWaiverPeriod () {
    if (!this.isRegularSeason) {
      return true
    }

    const now = this.now
    if (now.day() === 2) { // is Tuesday
      return true
    }

    if (now.day() === 3 && now.hour() < 15) { // is Wednesday before 3PM
      return true
    }

    return false
  }

  get week () {
    const diff = this.now.diff(this.start, 'weeks')
    return diff < 0 ? 0 : diff
  }

  get year () {
    const now = this.now
    return now.isBefore(this.end) ? this.start.year() : this.end.year()
  }
}
