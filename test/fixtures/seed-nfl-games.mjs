import knex from '#db'

import { current_season } from '#constants'
import {
  get_max_weeks_for_season_type,
  WEEK_RANGES
} from '#libs-shared/nfl-week-identifier.mjs'

// Opt-in REG+POST nfl_games seed for integration specs; esbid encoding: year + seas_type_code + week + index (REG=1 POST=3).
const SEAS_TYPE_CODE = { PRE: 0, REG: 1, POST: 3 }

const make_esbid = ({ year, seas_type, week, index }) => {
  const code = SEAS_TYPE_CODE[seas_type]
  return Number(
    `${year}${code}${String(week).padStart(2, '0')}${String(index).padStart(2, '0')}`
  )
}

const TEAMS = [
  ['KC', 'BUF'],
  ['PHI', 'SF']
]

const build_rows_for_weeks = ({ year, seas_type, min_week, max_week }) => {
  const rows = []
  for (let week = min_week; week <= max_week; week++) {
    for (let index = 1; index <= TEAMS.length; index++) {
      const [v, h] = TEAMS[index - 1]
      rows.push({
        esbid: make_esbid({ year, seas_type, week, index }),
        season_year: year,
        week,
        season_type: seas_type,
        v,
        h,
        // Plausible non-null date/time so downstream consumers that filter
        // on kickoff time (e.g. get-top-practice-squad-waiver) receive
        // populated values. Date is set far in the future to avoid
        // kickoff-filter drops in game-time-aware code paths.
        date: `${year + 1}/12/01`,
        time_est: '20:00:00'
      })
    }
  }
  return rows
}

export const seed_nfl_games = async ({ year = current_season.year } = {}) => {
  const rows = [
    ...build_rows_for_weeks({
      year,
      seas_type: 'REG',
      min_week: 1,
      max_week: get_max_weeks_for_season_type({ seas_type: 'REG', year })
    }),
    ...build_rows_for_weeks({
      year,
      seas_type: 'POST',
      min_week: WEEK_RANGES.POST.min,
      max_week: WEEK_RANGES.POST.max
    })
  ]
  await knex('nfl_games').insert(rows).onConflict('esbid').merge()
  return rows
}

export const clear_nfl_games = async ({ year = current_season.year } = {}) => {
  await knex('nfl_games').where({ season_year: year }).del()
}
