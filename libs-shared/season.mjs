import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import isBetween from 'dayjs/plugin/isBetween.js'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isBetween)

const LEAGUE_TIMEZONE = 'America/New_York'

// Every instant this class exposes is Eastern, and the fantasy week flips at
// local Tuesday 00:00 ET.
//
// The offset is DERIVED from the zone for that instant, then pinned as a fixed
// offset. Both halves are load-bearing.
//
// Deriving it replaces four hand-maintained `utcOffset(-5)` / `utcOffset(-4)`
// literals, each correct only while its date stayed on one side of a DST
// boundary, with nothing anywhere enforcing that. An `end` set past
// spring-forward rendered as Friday 23:00 under the literal and Saturday 00:00
// once derived.
//
// Pinning it -- rather than returning a `.tz()` zone object -- is what keeps
// the arithmetic right. dayjs's timezone plugin carries the offset captured at
// construction through `.add()`, so `regular_season_start.tz(...).add(9,
// 'week')` lands on Monday 23:00 ET once the November fall-back has passed
// instead of Tuesday 00:00. `week_end` is built that way and feeds the event
// windows in `libs-server/gambet.mjs` and `import-caesars-odds-v4.mjs`, so the
// drift would silently misfile an hour of betting events every week from
// November on. A fixed offset has no DST and so cannot drift.
export const eastern = (unix_seconds) => {
  const instant = dayjs.unix(unix_seconds)
  return instant.utc().utcOffset(instant.tz(LEAGUE_TIMEZONE).utcOffset())
}

export default class Season {
  constructor({
    offseason,
    regular_season_start,
    end,
    opening_day,
    final_week,
    nfl_final_week,
    regular_season_final_week,
    wildcard_week,
    super_bowl_bye_weeks = 1,
    // Optional, and defaulted so it READS optional. `now` pins the clock for a
    // test or a replay; absent it, the `now` getter below falls back to the
    // live Eastern-time clock, which is what every production caller wants and
    // what `season-dates.mjs` (the sole such caller) relies on. Without the
    // default, a destructured parameter with no initializer is a REQUIRED
    // member of the inferred shape, so a checked caller passing the real
    // season dates was reported as missing a property the class never wanted.
    now = null
  }) {
    // Super Bowl
    this.offseason = eastern(offseason)

    // Two Tuesdays before first game
    this.regular_season_start = eastern(regular_season_start)

    // super bowl
    this.end = eastern(end)

    // first game
    this.opening_day = eastern(opening_day)

    this.final_week = final_week
    this.nfl_final_week = nfl_final_week
    this.regular_season_final_week = regular_season_final_week
    this.wildcard_week = wildcard_week
    this.super_bowl_bye_weeks = super_bowl_bye_weeks

    if (now) {
      this._now = eastern(now)
    }
  }

  get now() {
    if (this._now) return this._now
    return eastern(dayjs().unix())
  }

  get is_offseason() {
    return this.week === 0
  }

  get is_regular_season() {
    const week = this.week
    return week > 0 && week <= this.final_week
  }

  // The retrospective half of the current / last-completed pair.
  //
  //   current (in play or next up)  |  last completed (has results)
  //   ------------------------------|------------------------------
  //   season: `year`                |  `last_completed_season_year`
  //   week:   current_nfl_week_*()  |  last_completed_nfl_week_*()
  //
  // Invariant: a week member's year equals the season member in its own
  // column. Reach for `year` for anything forward-looking -- salaries,
  // projections, betting markets, practice reports, schedules -- and for this
  // only when the caller genuinely needs a season that has results.
  //
  // The two are EQUAL during the season and differ for the six offseason
  // months, which is why a wrong choice is invisible from August to February
  // and then silently serves the prior season.
  get last_completed_season_year() {
    return this.week === 0 ? this.year - 1 : this.year
  }

  get last_week_with_stats() {
    const week = this.nfl_seas_week
    const day_of_week = this.now.day()
    const completed_week =
      day_of_week === 2 || day_of_week === 3 ? week - 1 : week
    return Math.max(completed_week, 1)
  }

  get is_waiver_period() {
    if (!this.is_regular_season) {
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

  // The constitution's definitions section fixes ONE Regular Season boundary:
  // "12:00 AM EST on the first Tuesday of Week 1 of the NFL Regular Season" --
  // the Tuesday immediately preceding the (always-Thursday) opener, which is
  // what this getter computes. `regular_season_start` is the Tuesday NINE days
  // before the opener, one week earlier, to anchor preseason roster and waiver
  // mechanics.
  //
  // Nine days is seven plus two, so `regular_season_start + 1 week` and this
  // getter are the SAME instant in every season, and so is the moment
  // `is_regular_season` turns true. That identity is not a coincidence to work
  // around -- it is the invariant that lets every caller ask `is_regular_season`
  // and get the constitutional answer. `test/season.spec.mjs` pins it against
  // `opening_day`, whose date is checkable against the NFL schedule, so a
  // mis-set anchor fails there instead of silently moving a boundary.
  //
  // This getter therefore has ONE remaining consumer: `is-santuary-period.mjs`,
  // which needs the boundary as a DATE to measure Article XIV Section 15(1)'s
  // "first twenty-four (24) hours of the Regular Season" from. A caller that
  // only wants to know whether the Regular Season has begun wants
  // `is_regular_season`; `api/routes/teams/protect.mjs` carried a redundant
  // `isBefore(practice_squad_protection_start)` guard behind that check until
  // it was removed, and it was unreachable for its whole life.
  //
  // The prose here used to claim `regular_season_start` was "two weeks
  // earlier", which reads as a justification for setting the anchor a week
  // early -- exactly the 2026 defect that unlinked every betting market from
  // its game.
  get practice_squad_protection_start() {
    const days_since_tuesday = (this.opening_day.day() - 2 + 7) % 7
    return this.opening_day.subtract(days_since_tuesday, 'day').startOf('day')
  }

  // POST week numbering, matching what `nfl_games` stores: 1 wild card,
  // 2 divisional, 3 conference, 4 super bowl.
  //
  // Wild card, divisional and conference run on the three weekends
  // immediately after the final regular-season week, so they number straight
  // through. Only the Super Bowl sits past the Pro Bowl bye, so
  // `super_bowl_bye_weeks` is subtracted THERE and nowhere else -- 6d2bf23e5
  // subtracted it uniformly to move the Super Bowl from 5 to 4, which moved
  // wild card to 0 and made every postseason odds import miss
  // `find_nfl_game`.
  //
  // The clamp holds the value inside `WEEK_RANGES.POST` once the Super Bowl
  // has passed and `season-dates.mjs` has not yet been bumped by hand;
  // without it the counter keeps climbing and yields identifiers like
  // `2026_POST_WEEK_7` that `validate_nfl_week_identifier` rejects.
  postseason_week(weeks_since_regular_season_start) {
    const round = weeks_since_regular_season_start - this.nfl_final_week
    if (round <= 3) {
      return round
    }
    return Math.min(round - this.super_bowl_bye_weeks, 4)
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
    } else if (diff > this.nfl_final_week) {
      seas_type = 'POST'
      week_number = this.postseason_week(diff)
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
    } else if (week > this.nfl_final_week) {
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
    } else if (week > this.nfl_final_week) {
      return this.postseason_week(week)
    } else {
      return week
    }
  }
}
