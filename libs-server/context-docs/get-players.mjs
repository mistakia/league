/**
 * Resolve display attributes for a set of player ids.
 *
 * Closes the player-name assembly gap: rosters and transactions carry only
 * `pid` strings, so this selects name/position/NFL-team in a single
 * `whereIn` and returns `{ [pid]: { name, pos, nfl_team } }`. Callers render
 * from this map so no bare pid ever reaches a doc.
 */
export default async function get_players({ db, pids }) {
  const unique_pids = [...new Set((pids || []).filter(Boolean))]
  if (!unique_pids.length) {
    return {}
  }

  const rows = await db('player')
    .whereIn('pid', unique_pids)
    .select('pid', 'fname', 'lname', 'pos', 'current_nfl_team')

  const players = {}
  for (const row of rows) {
    players[row.pid] = {
      name: `${row.fname} ${row.lname}`.trim(),
      pos: row.pos,
      nfl_team: row.current_nfl_team
    }
  }

  return players
}
