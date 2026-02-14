import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import isBetween from 'dayjs/plugin/isBetween.js'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isBetween)

// Convert any date to Eastern Time regardless of user's timezone
const toEasternTime = (date) => {
  return dayjs(date).tz('America/New_York')
}

// Get the correct Eastern Time offset for a given date
const getEstOffset = (datetime = new Date()) => {
  // Convert the date to Eastern Time to get the correct offset
  const easternTime = dayjs(datetime).tz('America/New_York')
  return easternTime.utcOffset()
}

export default class Season {
  constructor({
    offseason,
    regular_season_start,
    end,
    openingDay,
    finalWeek,
    nflFinalWeek,
    regularSeasonFinalWeek,
    wildcardWeek,
    superBowlByeWeeks = 1,
    now
  }) {
    // Super Bowl
    this.offseason = dayjs.unix(offseason).utc().utcOffset(-5)

    // Two Tuesdays before first game
    this.regular_season_start = dayjs
      .unix(regular_season_start)
      .utc()
      .utcOffset(-4)

    // super bowl
    this.end = dayjs.unix(end).utc().utcOffset(-5)

    // first game
    this.openingDay = dayjs.unix(openingDay).utc().utcOffset(-4)

    this.finalWeek = finalWeek
    this.nflFinalWeek = nflFinalWeek
    this.regularSeasonFinalWeek = regularSeasonFinalWeek
    this.wildcardWeek = wildcardWeek
    this.superBowlByeWeeks = superBowlByeWeeks

    if (now) {
      const d = dayjs.unix(now)
      const offset = getEstOffset(d.toDate())
      this._now = d.utc().utcOffset(offset)
    }
  }

  get now() {
    if (this._now) return this._now
    // Convert current time to Eastern Time
    return toEasternTime(dayjs())
  }

  get isOffseason() {
    return this.week === 0
  }

  get isRegularSeason() {
    const week = this.week
    return week > 0 && week <= this.finalWeek
  }

  // TODO rename to last_year_with_stats
  get stats_season_year() {
    return this.week === 0 ? this.year - 1 : this.year
  }

  get last_week_with_stats() {
    const week = this.nfl_seas_week
    const day_of_week = this.now.day()
    const completed_week =
      day_of_week === 2 || day_of_week === 3 ? week - 1 : week
    return Math.max(completed_week, 1)
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
    if (this.now < this.regular_season_start) {
      return 0
    }

    if (this.now > this.end) {
      return 0
    }

    return this.week
  }

  get week() {
    const diff = Math.max(0, this.now.diff(this.regular_season_start, 'weeks'))
    return diff
  }

  // will detect seas_type and return week number for that seas_type
  // POST and REG seas_type starts at 1
  // PRE seas_type starts at 0
  calculate_week(dayjs_date) {
    const diff = dayjs_date.diff(this.regular_season_start, 'weeks')
    let seas_type = 'PRE'
    let week_number = 0

    if (diff <= 0) {
      // Handle preseason weeks
      week_number = Math.max(diff + 3, 0)
      if (week_number > 4) {
        throw new Error('Date is before preseason start')
      }
    } else if (diff > this.nflFinalWeek) {
      seas_type = 'POST'
      week_number = Math.min(
        diff - this.nflFinalWeek - this.superBowlByeWeeks,
        4
      )
    } else {
      seas_type = 'REG'
      week_number = diff
    }

    return { seas_type, week: week_number }
  }

  get week_end() {
    const week = this.week
    return this.regular_season_start.add(week + 1, 'weeks')
  }

  get year() {
    const now = this.now
    return now.isBefore(this.end)
      ? this.regular_season_start.year()
      : this.end.year()
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
    const week = this.now.diff(this.regular_season_start, 'weeks')

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
      return week - this.nflFinalWeek - this.superBowlByeWeeks
    } else {
      return week
    }
  }
}
