import {
  current_season,
  fantasy_positions,
  external_data_sources
} from '#constants'
import db from '#db'

export default async function get_player_projections({
  year = current_season.year,
  week = current_season.nfl_seas_week,
  seas_type = 'REG',
  pids = [],
  include_averages = false
} = {}) {
  if (!pids.length) {
    const players = await db('player')
      .select('pid')
      .whereIn('pos', fantasy_positions)
      .whereNot({ current_nfl_team: 'INA' })
    players.forEach((p) => pids.push(p.pid))
  }

  const query = db
    .from('projections_index')
    .whereIn('pid', pids)
    .where({
      year,
      userid: 0,
      seas_type
    })
    .where('week', '>=', week)

  if (!include_averages) {
    query.whereNot('sourceid', external_data_sources.AVERAGE)
  }

  return query
}
