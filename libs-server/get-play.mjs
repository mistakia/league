import db from '#db'

import { fixTeam } from '#libs-shared'
import { MultiplePlayMatchError } from './play-cache.mjs'

/**
 * Finds the single play matching the given criteria.
 *
 * Returns null when nothing matches. Throws when MORE than one play matches --
 * "no such play" is a data question, "two plays answer to this description" is
 * an integrity alarm, and collapsing both to null is what let a duplicated game
 * silently drop three years of charting.
 *
 * @throws {MultiplePlayMatchError} If more than one play matches
 */
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
  yard_line_number,
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

  if (yard_line_number) {
    query.where({ yard_line_number })
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

  if (plays.length > 1) {
    throw new MultiplePlayMatchError(
      plays.length,
      {
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
        yard_line_number,
        yard_line_side,
        yard_line_100,
        seconds_remaining_quarter
      },
      plays.map((play) => ({ esbid: play.esbid, play_id: play.play_id }))
    )
  }

  return plays.length === 1 ? plays[0] : null
}
