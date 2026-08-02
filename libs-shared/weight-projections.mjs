import { all_projected_fantasy_stats, external_data_sources } from '#constants'

const removeFalsy = (obj) => {
  const newObj = {}
  Object.keys(obj).forEach((prop) => {
    if (obj[prop]) newObj[prop] = obj[prop]
  })
  return newObj
}

const weightProjections = ({ projections, weights = [], userId, week }) => {
  const data = {}
  for (const r of all_projected_fantasy_stats) {
    data[r] = []
  }

  // Guard on userId first. Without it, an absent `userid` on a source row
  // matches an absent `userId` argument (undefined === undefined) and that row
  // is treated as a user override, clobbering the consensus with one source's
  // raw numbers. Production rows come from projections_index and carry an
  // explicit null, which is why this never fired -- it is one column default
  // away from doing so.
  const userProjection =
    (userId &&
      projections.find((p) => p.userid === userId && p.week === week)) ||
    {}
  const sourceProjections = projections.filter(
    (p) =>
      p.sourceid &&
      p.week === week &&
      p.sourceid !== external_data_sources.AVERAGE
  )

  for (const projection of sourceProjections) {
    const { sourceid } = projection
    const source = weights.find((w) => w.uid === sourceid)
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
