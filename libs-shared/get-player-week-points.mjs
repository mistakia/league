// The one place that reads a player's projected total for a week, and the one
// place that orders players by it.
//
// A player's `points` map is populated per week only where a projection exists
// -- libs-server/get-players.mjs starts it EMPTY and fills only the weeks that
// came back from the projection tables. And the valuation pools deliberately
// contain players with no projection at all: process-projections.mjs builds a
// league's pool as `projection_pids.concat(rostered_pids)`, because replacement
// level is a question about a real roster and a roster holds players nobody
// projects. For league 1 that is 24 unprojected players in a pool of 1021.
//
// So an absent projection is routine, and the distinction that matters is that
// it is NOT a zero and NOT a low score -- it is a player who cannot be ranked at
// all. Returning null rather than undefined is what carries that into arithmetic
// instead of losing it.
//
// `points_key` is the key into the points map, NOT necessarily a week. The map
// carries the numeric fantasy weeks alongside the named periods `season` and
// `rest_of_season` (get-players.mjs fills all three from three tables), so a
// caller on the season path passes `season_aggregate_key` and a caller on the
// weekly path passes the week. The parameter was called `week` while only the
// second was true, and that is exactly how the season board came to read
// `points[0]` after the period split moved the season points to `points.season`
// -- a key that no longer existed, so every player fell through to the -999
// sentinel with no error anywhere. Name the axis, not one of its values.
export const get_player_week_total = ({ player, points_key }) => {
  const week_points = player.points ? player.points[points_key] : null
  if (!week_points) return null
  const total = Number(week_points.total)
  return Number.isFinite(total) ? total : null
}

// Descending by week total, as a TOTAL ORDER.
//
// The obvious form -- `(b.points[week] || {}).total - (a.points[week] || {}).total`
// -- returns NaN whenever either side has no projection for the week. A
// comparator that returns NaN is not an ordering at all, and V8's sort responds
// by placing elements arbitrarily: the damage is NOT confined to the unprojected
// players, it scatters the ones that sort fine.
//
// Measured at league 1's real ratio (24 unprojected among 1021, 200 trials),
// that left ~16 out-of-order pairs among the projected players per run and
// displaced individual players by as much as 936 ranks. In production it seated
// a 0.71-point bench quarterback ahead of every starting quarterback in the
// league and made him the QB replacement level for weeks 1 through 12.
//
// Callers should filter unprojected players out before sorting, since a player
// who cannot be ranked usually should not be in the population either. This
// orders them last rather than trusting that they did.
export const compare_player_week_points_desc = (points_key) => (a, b) => {
  const a_total = get_player_week_total({ player: a, points_key })
  const b_total = get_player_week_total({ player: b, points_key })

  if (a_total === null && b_total === null) return 0
  if (a_total === null) return 1
  if (b_total === null) return -1

  return b_total - a_total
}

export default get_player_week_total
