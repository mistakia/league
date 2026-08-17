import { all_projected_fantasy_stats, external_data_sources } from '#constants'

const removeFalsy = (obj) => {
  const newObj = {}
  Object.keys(obj).forEach((prop) => {
    if (obj[prop]) newObj[prop] = obj[prop]
  })
  return newObj
}

const has_any_projected_value = (projection) => {
  for (const stat of all_projected_fantasy_stats) {
    const value = projection[stat]
    if (value !== null && value !== undefined && Number(value) !== 0) {
      return true
    }
  }
  return false
}

const weightProjections = ({ projections, weights = [], userId, week }) => {
  const data = {}
  for (const r of all_projected_fantasy_stats) {
    data[r] = []
  }

  // Guard on userId first. Without it, an absent `user_id` on a source row
  // matches an absent `userId` argument (undefined === undefined) and that row
  // is treated as a user override, clobbering the consensus with one source's
  // raw numbers. Production rows come from projections_index and carry an
  // explicit null, which is why this never fired -- it is one column default
  // away from doing so.
  const userProjection =
    (userId &&
      projections.find((p) => p.user_id === userId && p.week === week)) ||
    {}
  const sourceProjections = projections.filter(
    (p) =>
      p.source_id &&
      p.week === week &&
      p.source_id !== external_data_sources.AVERAGE
  )

  for (const projection of sourceProjections) {
    // An ALL-ZERO row is a placeholder, not a forecast that the player will do
    // nothing. Sources store one when they carry the player but have no numbers
    // for him -- NFL (source 4) had exactly one 2026 QB row and every stat in it
    // was 0.0, for Josh Allen. Counting that as an opinion pulled his consensus
    // from ~3700 passing yards to 3185 and dropped him from QB1 to QB10.
    //
    // This is the same absent-versus-zero distinction as below, one level up: a
    // source that projects 0 rushing touchdowns ALONGSIDE 4000 passing yards has
    // an opinion and is kept, while a source that projects zero of everything
    // has none. The old truthiness guard hid these rows by accident; excluding
    // them is what makes discarding that guard safe.
    if (!has_any_projected_value(projection)) {
      continue
    }

    const { source_id } = projection
    const source = weights.find((w) => w.uid === source_id)
    const weight = source && source.weight !== null ? source.weight : 1

    for (const r in data) {
      // A source that says zero HAS an opinion. The previous truthiness guard
      // dropped it, so a stat two of three sources projected at zero averaged to
      // the third source's value instead of to a third of it.
      if (projection[r] !== null && projection[r] !== undefined) {
        data[r].push({
          weight,
          value: projection[r]
        })
      }
    }
  }

  const result = {}
  for (const r in data) {
    const item = data[r]
    if (!item.length) {
      // No source has an opinion. Writing 0 here fabricates a consensus: it is
      // indistinguishable downstream from every source agreeing on zero, and it
      // is how the four DST components no vendor supplies
      // (defensive_three_and_outs, defensive_fourth_down_stops,
      // defensive_points_against, defensive_yards_against) came to be projected
      // as 0.0 across all 32 defenses. Leave it null.
      result[r] = null
      continue
    }

    const totalWeight = item.reduce((a, b) => a + b.weight, 0)
    const values = item.map((a) => a.value)
    const appliedWeight = values.reduce(
      (sum, val, idx) => sum + item[idx].weight * val,
      0
    )

    result[r] = appliedWeight / totalWeight || 0
  }

  return Object.assign({}, result, removeFalsy(userProjection))
}

export default weightProjections
