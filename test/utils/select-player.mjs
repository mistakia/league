import db from '#db'
import { constants } from '#libs-shared'

export default async function ({
  pos = 'RB',
  rookie = false,
  exclude_pids = [],
  excludePS = false,
  nfl_status = undefined,
  injury_status = undefined,
  exclude_rostered_players = false,
  lid = 1,
  random = true // New option for backward compatibility - defaults to true
} = {}) {
  const query = db('player')
    .whereNot('current_nfl_team', 'INA')
    .where('pos1', pos)

  // Use deterministic ordering for tests when random is false
  if (random) {
    query.orderByRaw('RANDOM()')
  } else {
    query.orderBy('pid') // Deterministic ordering by player ID
  }

  query.limit(1)

  // Exclude rostered players if requested
  if (exclude_rostered_players) {
    const rostered_players = await db('rosters_players').where({
      lid,
      week: constants.season.week,
      year: constants.season.year
    })
    const rostered_pids = rostered_players.map((p) => p.pid)
    exclude_pids = [...exclude_pids, ...rostered_pids]
  }

  if (exclude_pids.length) {
    query.whereNotIn('pid', exclude_pids)
  }

  if (rookie) {
    query.where('nfl_draft_year', constants.season.year)
  } else {
    query.whereNot('nfl_draft_year', constants.season.year)
  }

  if (excludePS) {
    query.whereNot('posd', 'PS')
  }

  if (nfl_status) {
    query.where('nfl_status', nfl_status)
  }

  if (injury_status !== undefined) {
    if (injury_status === null) {
      query.whereNull('injury_status')
    } else {
      query.where('injury_status', injury_status)
    }
  }

  const players = await query
  return players[0]
}
