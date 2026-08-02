// Cross-vendor disagreement about a player's season, in fantasy points.
//
// weight-projections.mjs averages the sources per STAT and throws the spread
// away. That spread is the only forward-looking uncertainty estimate available
// at projection time, and the valuation model needs it: a roster spot pays
// max(X - baseline, 0), which is convex, so a point estimate understates every
// player and understates most where disagreement is largest.
//
// Dispersion is measured on TOTAL FANTASY POINTS, not per stat, because that is
// the quantity the valuation draws. Summing per-stat standard deviations would
// need the cross-stat covariance, which is not recoverable from an average.
// That makes this scoring-format dependent, which is why it lives here and not
// in weight-projections.mjs -- the caller supplies per-source totals it has
// already scored.
//
// Nothing here is fitted. The output is the sample standard deviation of the
// sources, rescaled by the independently measured ratio below.

// Cross-vendor disagreement is not the same quantity as the uncertainty the
// valuation needs. Sources cluster: they read the same depth charts and regress
// toward each other, so the spread BETWEEN them is far narrower than the spread
// between any of them and the season that actually happens. The ratio of the two
// is what this constant carries.
//
// MEASURED, not tuned. For each position, over 2020-2025 season-long
// (`projections_index` week 0, the frozen preseason board) at the genesis_10_team
// scoring format: the sample standard deviation of the per-source scored totals,
// against the standard deviation of `realized - consensus` residuals over the
// same player set. Both are properties of the projection sources and the seasons
// they described; neither reads a price, a salary, an auction outcome, or any
// output of this model. The ratio is near-constant across positions, which is
// itself the evidence that it is a property of the sources rather than an
// artifact of one position's sample.
//
// WHAT WOULD FALSIFY IT: re-measuring the same two dispersions on a later season
// set and finding the ratio has moved materially off ~4.2-4.6, or finding it
// spread widely across positions. Either would mean the vendor panel's
// clustering has changed and the constant no longer describes it. It is not
// falsified by the board disagreeing with auction prices -- that comparison is
// not evidence about this quantity in either direction.
//
// WHY IT IS APPLIED AT ALL. An earlier reading of the evidence concluded no
// scalar should be used, on two grounds that do not survive. The first was
// "responsiveness", an across-year correlation on six observations whose 95%
// interval spans roughly [-0.9, +1.0] -- it cannot discriminate between scales in
// either direction. The second was mean positional share error, which is flat
// from x1 to x4.4 (3.57-3.76, inside Monte Carlo noise) and so does not
// discriminate either. Neither measured the two things that DO separate the
// scales, enormously: price level and concentration. At raw vendor spread the
// 2026 board prices its top player at $87 with 122 players above $0; at the
// measured ratio, $43-46 across runs with 251, against a realized top-1 share of
// 1.98% (~$40) and roughly 330 players finishing above replacement.
//
// See user:text/league/points-added-valuation-model.md for the standing
// yardsticks and user:guideline/league/points-added-valuation.md for the rule
// this constant is admissible under.
export const realized_to_vendor_dispersion_ratio = {
  QB: 4.42,
  RB: 4.25,
  WR: 4.41,
  TE: 4.55,
  DST: 4.25
}

// A position the measurement does not cover takes the mean of those it does,
// rather than 1 -- treating an unmeasured position as having no gap between
// vendor spread and realized spread is the one reading the measurement rules out.
const default_dispersion_ratio =
  Object.values(realized_to_vendor_dispersion_ratio).reduce(
    (total, value) => total + value,
    0
  ) / Object.keys(realized_to_vendor_dispersion_ratio).length

const mean_of = (values) =>
  values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0

// Sample standard deviation (n-1). Returns 0 for fewer than two observations,
// which the caller distinguishes from a real zero via the fallback below.
export const sample_standard_deviation = (values) => {
  if (values.length < 2) return 0
  const mean = mean_of(values)
  const sum_squares = values.reduce(
    (total, value) => total + (value - mean) ** 2,
    0
  )
  return Math.sqrt(sum_squares / (values.length - 1))
}

// Returns the ESTIMATED DISPERSION OF THE PLAYER'S REALIZED SEASON, in fantasy
// points -- the vendor spread rescaled by the ratio above. That, not the raw
// vendor spread, is the quantity the valuation draws from, which is why the
// rescale happens here rather than at the call site: there is one definition of
// the drawable dispersion and one place it is produced.
//
// A player carried by only one source has no measurable disagreement, and
// treating that as certainty would make him a risk-free asset -- exactly
// backwards, since thin coverage means an obscure player. Substitute the
// position's median dispersion so he is drawn with typical uncertainty.
export const calculate_projection_dispersion = ({
  source_totals_by_pid,
  position_by_pid,
  minimum_sources = 2
}) => {
  const measured_by_pid = {}
  const measured_by_position = {}

  for (const pid of Object.keys(source_totals_by_pid)) {
    const position = position_by_pid[pid]
    if (!position) continue
    const totals = source_totals_by_pid[pid] || []
    if (totals.length < minimum_sources) continue
    const dispersion = sample_standard_deviation(totals)
    measured_by_pid[pid] = dispersion
    if (!measured_by_position[position]) measured_by_position[position] = []
    measured_by_position[position].push(dispersion)
  }

  const median_by_position = {}
  for (const position of Object.keys(measured_by_position)) {
    const sorted = measured_by_position[position].slice().sort((a, b) => a - b)
    const ratio =
      realized_to_vendor_dispersion_ratio[position] ?? default_dispersion_ratio
    median_by_position[position] = sorted[Math.floor(sorted.length / 2)] * ratio
  }

  const dispersion_by_pid = {}
  for (const pid of Object.keys(source_totals_by_pid)) {
    const position = position_by_pid[pid]
    if (!position) continue
    // The median fallback is already rescaled above, so only the measured branch
    // applies the ratio here. Rescaling is linear, so a position's median of
    // rescaled values and the rescaled median of its raw values are the same
    // number -- the split is about not applying it twice, not about order.
    const ratio =
      realized_to_vendor_dispersion_ratio[position] ?? default_dispersion_ratio
    dispersion_by_pid[pid] =
      measured_by_pid[pid] !== undefined
        ? measured_by_pid[pid] * ratio
        : median_by_position[position] || 0
  }

  return { dispersion_by_pid, median_by_position }
}

export default calculate_projection_dispersion
