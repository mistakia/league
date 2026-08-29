import {
  current_season,
  fantasy_positions,
  external_data_sources
} from '#constants'
import db from '#db'

// THIS FUNCTION READS GAME WEEKS ONLY. The season-long projection is not here
// and cannot be reached from here: it lives in `season_projections_index`, which
// carries no `week` column, and `get-season-projections.mjs` is its reader.
//
// That separation is the fix for the 2026-08-04 outage rather than a tidy-up.
// `projections_index.week` used to encode the season-long row as `0`, so this
// floor decided whether callers saw it. The floor was `current_season.nfl_seas_week`,
// which steps 0 -> 1 -> 2 -> 3 across the preseason as each Tuesday passes; the
// moment it left 0 it amputated every season row. process-projections then wrote
// an all-null season consensus, every player fell out of the drawn pool in
// calculate-distributional-baselines, and market_salary priced at $0 on 22 of 23
// league formats. Nothing failed -- the query was valid and returned rows, just
// never the season ones. No floor here can do that any more, because there is no
// season row in this table for a floor to exclude.
//
// REG uses `active_fantasy_week`, the fantasy week floored to 1. POST rows are
// keyed by `nfl_seas_week` (1..4) rather than by a fantasy week, so the
// postseason floor still comes from there.
const default_week_floor = (season_type) =>
  season_type === 'POST'
    ? current_season.nfl_seas_week
    : current_season.active_fantasy_week

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
      season_type
    })
    .where('week', '>=', week)

  if (!include_averages) {
    query.whereNot('source_id', external_data_sources.AVERAGE)
  }

  return query
}
