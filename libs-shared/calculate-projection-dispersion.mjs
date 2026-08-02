import { fantasy_positions } from '#constants'
import { get_player_week_total } from './get-player-week-points.mjs'

// The estimated dispersion of a player's REALIZED season around his projection,
// in fantasy points. This is what the valuation draws from: a roster spot pays
// max(X - baseline, 0), which is convex, so a point estimate understates every
// player and understates most where uncertainty is largest.
//
// WHAT THIS USED TO BE, AND WHY IT IS NOT. The first version of this module took
// the cross-vendor spread -- the sample standard deviation of the individual
// sources' scored totals -- and rescaled it per player by a measured
// realized-to-vendor ratio of about 4.4. The ratio itself was real, but it was a
// ratio of two POPULATION aggregates, and applying it per player asserts
// something the aggregate never tested: that a player whose vendors disagree
// twice as much has twice the realized dispersion.
//
// Measured over 2020-2025, he does not. Splitting the board by projection level
// first and then by vendor spread inside each half, a 6.8x change in vendor
// spread moves realized residual dispersion by 1.22x at QB, 1.09x at RB, 1.11x
// at WR and 1.12x at TE -- and the wrong way at DST. Cross-vendor disagreement
// carries almost no cross-sectional signal about how far a season lands from its
// projection. Sources argue most about players they are all guessing at, not
// about players who are genuinely more variable.
//
// The cost of assuming otherwise was not academic. It gave Jacoby Brissett a
// dispersion of 221 points against a 265-point projection, drew him 780-point
// seasons at the 99th percentile, and priced him at $27 -- where the highest QB
// season any of the six measured years produced was 482. Half his value came
// from the top decile of draws.
//
// WHAT DOES PREDICT IT is the size of the projection, and the relationship is
// affine rather than proportional: dispersion RISES with the projection but its
// RATIO to the projection falls (QB 0.63 at the bottom quartile down to 0.28 at
// the top). A purely proportional model is the same mistake in another form.
//
//   dispersion = top_projection_share * position_scale + projection_slope * projection
//
// MEASURED, not tuned. Per position over 2020-2025, `projections_index` week 0
// (the frozen preseason board) against realized `scoring_format_player_seasonlogs`:
// bin the position by projection, take the standard deviation of
// (realized - projection) inside each bin, and regress those on the bins' mean
// projection. Both terms are linear in the format's point scale, so the two
// constants are DIMENSIONLESS.
//
// That is the point of expressing them this way, and it is the check that they
// describe the projection panel rather than one league. Re-measured across six
// different scoring formats they barely move:
//
//   position   top_projection_share        projection_slope
//   QB         0.203  (0.178 - 0.221)      0.117  (0.091 - 0.140)
//   RB         0.150  (0.147 - 0.151)      0.223  (0.219 - 0.230)
//   WR         0.150  (0.146 - 0.155)      0.178  (0.175 - 0.180)
//   TE         0.182  (0.176 - 0.189)      0.157  (0.149 - 0.162)
//   DST        0.267  (0.267 - 0.268)      0.091  (0.091 - 0.092)
//
// Nothing here reads a price, a salary, an auction outcome, or any output of
// this model. It is fitted against realized OUTCOMES, which is the standing
// every other measured input to this system has.
//
// WHAT WOULD FALSIFY IT: re-measuring on a later season set and finding either
// constant has moved materially, or finding they diverge across scoring formats
// -- either would mean the relationship is not the scale-free property claimed
// here. It is NOT falsified by the board disagreeing with auction prices; that
// comparison is not evidence about this quantity in either direction.
export const dispersion_model = {
  QB: { top_projection_share: 0.203, projection_slope: 0.117 },
  RB: { top_projection_share: 0.15, projection_slope: 0.223 },
  WR: { top_projection_share: 0.15, projection_slope: 0.178 },
  TE: { top_projection_share: 0.182, projection_slope: 0.157 },
  DST: { top_projection_share: 0.267, projection_slope: 0.091 }
}

// A position the measurement does not cover takes the mean of those it does.
// Treating an unmeasured position as having no dispersion is the one reading the
// measurement rules out.
const default_model = {
  top_projection_share:
    Object.values(dispersion_model).reduce(
      (total, value) => total + value.top_projection_share,
      0
    ) / Object.keys(dispersion_model).length,
  projection_slope:
    Object.values(dispersion_model).reduce(
      (total, value) => total + value.projection_slope,
      0
    ) / Object.keys(dispersion_model).length
}

// The scale anchor is the mean projection of the position's best `n` players on
// the board being priced. It must not depend on how DEEP the projection set runs
// -- a mean over everyone projected moves the moment a vendor adds forty more
// bench players, which would silently rescale every dispersion on the board. The
// measurement used the same definition.
export const top_projection_count = 12

const mean_of = (values) =>
  values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0

export const calculate_position_scale = ({ projections }) => {
  const top = projections
    .filter((value) => value > 0)
    .sort((a, b) => b - a)
    .slice(0, top_projection_count)
  return mean_of(top)
}

// players: [{ pid, primary_position, points: { [week]: { total } } }]
//
// Returns the estimated realized dispersion per pid, in the same points the
// board is scored in, plus the per-position scale anchors for inspection.
//
// It is computed from the board rather than read off a stored column on purpose.
// Dispersion is a function of the projection, so a board recomputed under
// different source weights -- which is exactly what the SPA's client-side worker
// does -- must carry the dispersion that goes with THAT board, not the one the
// cron happened to persist.
export const calculate_projection_dispersion = ({ players, week }) => {
  const projections_by_position = {}
  const projection_by_pid = {}
  const position_by_pid = {}

  for (const player of players) {
    const position = player.primary_position
    if (!fantasy_positions.includes(position)) continue
    const total = get_player_week_total({ player, week })
    if (!(total > 0)) continue
    projection_by_pid[player.pid] = total
    position_by_pid[player.pid] = position
    projections_by_position[position] = projections_by_position[position] || []
    projections_by_position[position].push(total)
  }

  const scale_by_position = {}
  for (const position of Object.keys(projections_by_position)) {
    scale_by_position[position] = calculate_position_scale({
      projections: projections_by_position[position]
    })
  }

  const dispersion_by_pid = {}
  for (const pid of Object.keys(projection_by_pid)) {
    const position = position_by_pid[pid]
    const model = dispersion_model[position] ?? default_model
    const scale = scale_by_position[position] || 0
    dispersion_by_pid[pid] = Math.max(
      model.top_projection_share * scale +
        model.projection_slope * projection_by_pid[pid],
      0
    )
  }

  return { dispersion_by_pid, scale_by_position }
}

export default calculate_projection_dispersion
