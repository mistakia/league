// The one place that reads a player's projected total for a week, and the one
// place that orders players by it.
//
// A missing projection is routine, not exceptional: get-players.mjs starts the
// `points` map EMPTY and fills only the weeks the projection tables returned, and
// valuation pools deliberately hold unprojected players, since
// process-projections.mjs builds the pool as `projection_pids.concat(rostered_pids)`
// and replacement level is a question about a real roster. The distinction that
// matters is that such a player is NOT a zero and NOT a low score -- they cannot be
// ranked at all. Returning null rather than undefined carries that into arithmetic
// instead of losing it.
//
// `points_key` is the key into the points map, NOT necessarily a week: the map
// carries the numeric fantasy weeks alongside the named periods `season` and
// `rest_of_season`, so a season-path caller passes `season_aggregate_key` and a
// weekly-path caller passes the week. While the parameter was named `week`, the
// season board read `points[0]`, a key that did not exist, and every player fell
// through to the -999 sentinel with no error. Name the axis, not one of its values.
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
// players, it scatters the ones that sort fine. In production that seated a
// near-zero bench quarterback ahead of every starter and made him the QB
// replacement level.
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
