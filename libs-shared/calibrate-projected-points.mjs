import { fantasy_positions } from '#constants'

// Below this correlation a position's projected ordering is not distinguishable
// from a random one, so the honest calibrated board has NO spread: every player
// at the position gets the position's expected outcome and therefore zero points
// added and a zero price. Producing a confident-looking ranking instead is what
// let 32 defenses -- fitted at r = 0.08, four times less informative than simply
// copying last season's box score -- carry a uniform negative block of
// pts_added. Calibration is the mechanism that converts "no information" into
// "no dollars".
export const projection_calibration_trust_floor = 0.2

// Projections are regressed toward the mean by construction; the value pipeline
// consumed them as if they were expectations. Applying the fitted
// `realized ~ intercept + slope x projected` puts them back on the realized
// scale before baselines and prices are derived from them.
//
// The intercept cancels out of pts_added WITHIN a position (the baseline shifts
// with the board), so it matters only through cross-position slot competition --
// which is exactly where an over-spread position like QB was mis-allocating
// flex and superflex slots.
//
// Mutates in place: calculateValues and calculatePrices write pts_added and
// market_salary back onto these same objects, so the calibrated board cannot be
// a copy. The vendor consensus is preserved as `projected_total` on each point
// row, and the raw projections_index rows are never touched -- the API keeps
// serving the uncalibrated projection.
const calibrate_projected_points = ({ players, calibration, week }) => {
  if (!calibration) {
    return players
  }

  const totals_by_position = {}
  for (const position of fantasy_positions) {
    totals_by_position[position] = []
  }

  for (const player of players) {
    const { primary_position } = player
    if (!fantasy_positions.includes(primary_position)) continue
    const point_row = player.points[week]
    const total = point_row ? point_row.total : null
    if (total === null || total === undefined) continue
    totals_by_position[primary_position].push(Number(total))
  }

  const means = {}
  for (const [position, totals] of Object.entries(totals_by_position)) {
    if (!totals.length) continue
    means[position] =
      totals.reduce((sum, value) => sum + value, 0) / totals.length
  }

  for (const player of players) {
    const { primary_position } = player
    const fit = calibration[primary_position]
    if (!fit) continue

    const point_row = player.points[week]
    if (!point_row) continue

    const projected_total = Number(point_row.total)
    if (!Number.isFinite(projected_total)) continue

    const mean_projected = means[primary_position]
    const input =
      fit.r < projection_calibration_trust_floor
        ? mean_projected
        : projected_total

    if (input === undefined) continue

    point_row.projected_total = projected_total
    point_row.total = fit.intercept + fit.slope * input
  }

  return players
}

export default calibrate_projected_points
