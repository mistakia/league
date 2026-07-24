import db from '#db'

import { fixTeam } from '#libs-shared'

export default async function ({
  esbid,
  play_id,

  week,
  season_year,
  offense_nfl_team,
  defense_nfl_team,

  qtr,
  game_clock_start,
  dwn,
  yards_to_go,
  play_type,
  ydl_num,
  ydl_side,
  ydl_100,
  sec_rem_qtr
}) {
  const query = db('nfl_plays')

  if (esbid) {
    query.where({ esbid })
  }

  if (play_id) {
    query.where({ play_id })
  }

  if (week) {
    query.where({ week })
  }

  if (season_year) {
    query.where({ season_year })
  }

  if (offense_nfl_team) {
    query.where({ offense_nfl_team: fixTeam(offense_nfl_team) })
  }

  if (defense_nfl_team) {
    query.where({ defense_nfl_team: fixTeam(defense_nfl_team) })
  }

  if (qtr) {
    query.where({ qtr: Number(qtr) })
  }

  if (game_clock_start) {
    query.where({ game_clock_start })
  }

  if (dwn) {
    query.where({ dwn: Number(dwn) })
  }

  if (play_type) {
    query.where({ play_type })
  }

  if (ydl_num) {
    query.where({ ydl_num })
  }

  if (ydl_side) {
    query.where({ ydl_side: fixTeam(ydl_side) })
  }

  if (ydl_100) {
    query.where({ ydl_100 })
  }

  if (yards_to_go) {
    query.where({ yards_to_go })
  }

  if (sec_rem_qtr) {
    query.where({ sec_rem_qtr })
  }

  const plays = await query
  if (plays.length === 1) {
    return plays[0]
  } else {
    return null
  }
}
