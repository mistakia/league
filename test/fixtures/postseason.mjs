/* global describe, before, after */

import MockDate from 'mockdate'

import { current_season } from '#constants'
import {
  seed_nfl_games,
  clear_nfl_games
} from './seed-nfl-games.mjs'

const {
  regular_season_start,
  nflFinalWeek,
  superBowlByeWeeks = 1
} = current_season

const week_offset_for_seas_type = (seas_type, week = 1) => {
  if (seas_type === 'REG') return week
  if (seas_type === 'POST') return nflFinalWeek + superBowlByeWeeks + week
  return week
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
