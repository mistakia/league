import { all_projected_fantasy_stats, external_data_sources } from '#constants'

const has_any_projected_value = (projection) => {
  for (const stat of all_projected_fantasy_stats) {
    const value = projection[stat]
    if (value !== null && value !== undefined && Number(value) !== 0) {
      return true
    }
  }
  return false
}

// The weighting core, over a projection set the caller has ALREADY narrowed to
// one period. It is period-blind on purpose: the season set comes from
// `season_projections_index`, which carries no `week` column at all, so a week
// comparison here would be `undefined === undefined` on every row and would
// silently pass for the wrong reason. Each period arm below states its own
// narrowing rather than sharing a defaulted one.
const weight_narrowed_projections = ({ sourceProjections, weights }) => {
  const data = {}
  for (const r of all_projected_fantasy_stats) {
    data[r] = []
  }

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
    const source = weights.find((w) => w.source_id === source_id)
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

  return result
}

const is_real_source = (p) =>
  p.source_id && p.source_id !== external_data_sources.AVERAGE

// The per-week consensus. Its rows come from `projections_index`, which holds
// every week side by side, so narrowing to one week is this function's job.
//
// There is no user-override arm. One existed until the user-projection feature
// was removed: it took a `userId`, found that user's row, and let it displace
// the consensus stat by stat. Nothing has passed `userId` since, and
// `projections_index` no longer has a `user_id` column at all, so the arm has
// nothing left to read even in principle.
const weightProjections = ({ projections, weights = [], week }) =>
  weight_narrowed_projections({
    weights,
    sourceProjections: projections.filter(
      (p) => is_real_source(p) && p.week === week
    )
  })

// The season-long consensus. Its input rows come from
// `season_projections_index`, one row per (source_id, pid, season_year), so the
// period narrowing is the QUERY's job and there is nothing left to filter on
// here beyond excluding AVERAGE. Excluding AVERAGE is load-bearing rather than
// tidy: this function's own output is written back to the same table under the
// AVERAGE source_id, so without it each hourly run would feed the consensus its
// own prior output and the board would drift toward a fixed point of itself.
export const weight_season_projections = ({ projections, weights = [] }) =>
  weight_narrowed_projections({
    weights,
    sourceProjections: projections.filter(is_real_source)
  })

export default weightProjections
