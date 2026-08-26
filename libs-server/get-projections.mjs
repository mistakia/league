import {
  current_season,
  fantasy_positions,
  external_data_sources
} from '#constants'
import db from '#db'

// `projections_index.week` is a FANTASY week: `0` is the season-long row every
// other week sits beside, and 1..N are the game weeks. The floor below has to be
// stated in that vocabulary.
//
// `current_season.week` is. It counts from `regular_season_start` and clamps at
// zero, so it reads 0 for the whole offseason and preseason and only leaves 0
// once the regular season starts -- exactly when the season row stops being the
// thing a caller wants.
//
// `current_season.nfl_seas_week` is NOT. It is the NFL week, and it steps
// 0 -> 1 -> 2 -> 3 across the preseason as each Tuesday passes. Using it as the
// floor amputated every week-0 row the moment it left 0, at 2026-08-04 04:00
// UTC: process-projections then wrote an all-null season consensus, every
// player fell out of the drawn pool in calculate-distributional-baselines, and
// market_salary priced at $0 on 22 of 23 league formats. Nothing failed -- the
// query was valid and returned rows, just never the season ones.
//
// POST rows are the exception, and are keyed by `nfl_seas_week` (1..4) rather
// than by a fantasy week, so the postseason floor still comes from there.
const default_week_floor = (season_type) =>
  season_type === 'POST' ? current_season.nfl_seas_week : current_season.week

export default async function get_player_projections({
  season_year = current_season.year,
  season_type = 'REG',
  week = default_week_floor(season_type),
  pids = [],
  include_averages = false
} = {}) {
  if (!pids.length) {
    const players = await db('player')
      .select('pid')
      .whereIn('primary_position', fantasy_positions)
      .whereNot({ current_nfl_team: 'INA' })
    players.forEach((p) => pids.push(p.pid))
  }

  const query = db
    .from('projections_index')
    .whereIn('pid', pids)
    .where({
      season_year,
      user_id: 0,
      season_type
    })
    .where('week', '>=', week)

  if (!include_averages) {
    query.whereNot('source_id', external_data_sources.AVERAGE)
  }

  return query
}
