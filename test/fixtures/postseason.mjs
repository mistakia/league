/* global describe, before, after */

import MockDate from 'mockdate'

import { current_season } from '#constants'
import { seed_nfl_games, clear_nfl_games } from './seed-nfl-games.mjs'

const { regular_season_start, nflFinalWeek } = current_season

// Weekends after the final regular-season week, per the NFL playoff calendar:
// wild card, divisional and conference run on consecutive weekends, and the
// Super Bowl is one Pro Bowl bye weekend after conference. Verified against
// `nfl_games` POST kickoffs for 2022, 2023 and 2024, where the conference-to-
// Super Bowl gap is 14 days every year.
//
// These are literals rather than `superBowlByeWeeks + week` on purpose. That
// expression is the algebraic inverse of `Season.postseason_week`, so a
// fixture built from it pins whatever the getter currently does and cannot
// tell a correct getter from a broken one -- which is how the uniform bye
// subtraction survived here for six months.
const WEEKENDS_AFTER_REGULAR_SEASON = { 1: 1, 2: 2, 3: 3, 4: 5 }

export const week_offset_for_seas_type = (seas_type, week = 1) => {
  if (seas_type === 'POST') {
    const weekends = WEEKENDS_AFTER_REGULAR_SEASON[week]
    if (!weekends) {
      throw new Error(`no POST week ${week} in the NFL playoff calendar`)
    }
    return nflFinalWeek + weekends
  }
  return week
}

// Pins the clock to the weekend of a given season type and week. Every spec
// that needs a postseason clock goes through here, so the calendar above is
// the single place the mapping lives.
export const set_date_for_week = ({ seas_type, week }) => {
  MockDate.set(
    regular_season_start
      .add(week_offset_for_seas_type(seas_type, week), 'week')
      .toISOString()
  )
}

export const run_under_season_type = (seas_type, fn, options = {}) => {
  const { seed_nfl_games: seed = false, seed_year } = options
  describe(`[under ${seas_type}]`, function () {
    before(async () => {
      const offset = week_offset_for_seas_type(seas_type)
      MockDate.set(regular_season_start.add(offset, 'week').toISOString())
      if (seed) {
        await seed_nfl_games({ year: seed_year })
      }
    })

    after(async () => {
      MockDate.reset()
      if (seed) {
        await clear_nfl_games({ year: seed_year })
      }
    })

    fn()
  })
}

export const with_postseason_date = (cb) => {
  const offset = week_offset_for_seas_type('POST')
  MockDate.set(regular_season_start.add(offset, 'week').toISOString())
  try {
    return cb()
  } finally {
    MockDate.reset()
  }
}
