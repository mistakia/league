import {
  current_season,
  fantasy_positions,
  external_data_sources
} from '#constants'
import db from '#db'

// The season-long half of `get-projections.mjs`, split out when the season row
// left the `projections_index` week-0 sentinel for its own table.
//
// It takes NO `week` argument, and that is the whole point of the split rather
// than an omission. `season_projections_index` carries no `week` column, so
// there is no predicate for a clock to move and no floor for a preseason
// `nfl_seas_week` step to amputate. The 2026-08-04 outage -- a week floor that
// left 0 and took every season row with it -- has no expressible form here.
//
// It also takes no `season_type`. Every season-long row is REG by construction:
// the table carries no `season_type` column, and a season-long projection covers
// the regular season by definition. POST projections stay per-week in
// `projections_index`, keyed by `nfl_seas_week`.
export default async function get_season_projections({
  season_year = current_season.year,
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
    .from('season_projections_index')
    .whereIn('pid', pids)
    .where({ season_year })

  if (!include_averages) {
    query.whereNot('source_id', external_data_sources.AVERAGE)
  }

  return query
}
