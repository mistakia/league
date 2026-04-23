import knex from '#db'

import { current_season } from '#constants'

// Matches seed-nfl-games esbid scheme so plays join cleanly to seeded games.
const SEAS_TYPE_CODE = { PRE: 0, REG: 1, POST: 3 }

const make_esbid = ({ year, seas_type, week, index }) => {
  const code = SEAS_TYPE_CODE[seas_type]
  return Number(
    `${year}${code}${String(week).padStart(2, '0')}${String(index).padStart(2, '0')}`
  )
}

const NOW = () => Math.round(Date.now() / 1000)

const build_play_row = ({ year, seas_type, week, esbid, play_id, off }) => ({
  esbid,
  playId: play_id,
  year,
  seas_type,
  week,
  updated: NOW(),
  off,
  play_type: 'RUSH',
  qb_kneel: false,
  first_down: false,
  qtr: 1,
  dwn: 1,
  yards_to_go: 10
})

const build_stat_row = ({ esbid, play_id, club_code }) => ({
  esbid,
  playId: play_id,
  statId: play_id,
  playerName: `test-player-${play_id}`,
  valid: true,
  yards: 7,
  clubCode: club_code
})

const build_rows = ({ year, seas_type, week, plays_per_game, game_count }) => {
  const plays = []
  const stats = []
  for (let index = 1; index <= game_count; index++) {
    const esbid = make_esbid({ year, seas_type, week, index })
    const off = index === 1 ? 'KC' : 'PHI'
    for (let play_id = 1; play_id <= plays_per_game; play_id++) {
      plays.push(build_play_row({ year, seas_type, week, esbid, play_id, off }))
      stats.push(build_stat_row({ esbid, play_id, club_code: off }))
    }
  }
  return { plays, stats }
}

export const seed_nfl_plays_current_week = async ({
  year = current_season.year,
  seas_type,
  week,
  plays_per_game = 1,
  game_count = 1
} = {}) => {
  const { plays, stats } = build_rows({
    year,
    seas_type,
    week,
    plays_per_game,
    game_count
  })
  await knex('nfl_plays_current_week').insert(plays)
  await knex('nfl_play_stats_current_week').insert(stats)
  return { plays, stats }
}

export const clear_nfl_plays_current_week = async () => {
  await knex('nfl_play_stats_current_week').del()
  await knex('nfl_plays_current_week').del()
}

export const seed_nfl_plays = async ({
  year,
  seas_type,
  week,
  plays_per_game = 1,
  game_count = 1
}) => {
  const { plays, stats } = build_rows({
    year,
    seas_type,
    week,
    plays_per_game,
    game_count
  })
  await knex('nfl_plays').insert(plays)
  await knex('nfl_play_stats').insert(stats)
  return { plays, stats }
}

export const clear_nfl_plays = async ({ year } = {}) => {
  if (year) {
    const esbids = await knex('nfl_plays').select('esbid').where({ year })
    const esbid_list = esbids.map((r) => r.esbid)
    if (esbid_list.length) {
      await knex('nfl_play_stats').whereIn('esbid', esbid_list).del()
    }
    await knex('nfl_plays').where({ year }).del()
  } else {
    await knex('nfl_play_stats').del()
    await knex('nfl_plays').del()
  }
}
