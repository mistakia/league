import moment from 'moment'

export default class Season {
  constructor () {
    this.start = moment('9/1/20 -0400', 'M/D/YY Z') // Two Tuesdays before first game
    this.end = moment('2/7/21 -0400', 'M/D/YY Z') // super bowl
    this.finalWeek = 16
  }

  get now () {
    return moment().utcOffset(-4)
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

    if (now.day() === 3 && now.hour() < 14) { // is Wednesday before 3PM
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
