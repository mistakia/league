import db from '#db'

import { fixTeam } from '#libs-shared'

export default async function ({
  esbid,
  play_id,

  week,
  season_year,
  offense_nfl_team,
  defense_nfl_team,

  quarter,
  game_clock_start,
  down_number,
  yards_to_go,
  play_type,
  yard_line_num,
  yard_line_side,
  yard_line_100,
  seconds_remaining_quarter
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

  if (quarter) {
    query.where({ quarter: Number(quarter) })
  }

  if (game_clock_start) {
    query.where({ game_clock_start })
  }

  if (down_number) {
    query.where({ down_number: Number(down_number) })
  }

  if (play_type) {
    query.where({ play_type })
  }

  if (yard_line_num) {
    query.where({ yard_line_num })
  }

  if (yard_line_side) {
    query.where({ yard_line_side: fixTeam(yard_line_side) })
  }

  if (yard_line_100) {
    query.where({ yard_line_100 })
  }

  if (yards_to_go) {
    query.where({ yards_to_go })
  }

  if (seconds_remaining_quarter) {
    query.where({ seconds_remaining_quarter })
  }

  const plays = await query
  if (plays.length === 1) {
    return plays[0]
  } else {
    return null
  }
}
