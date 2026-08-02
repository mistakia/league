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
// sources, used at its measured scale with no multiplier. The vendor spread is
// known to understate realized residual dispersion by roughly 4x, but every
// scalar tested made positional accuracy worse or no better while degrading the
// board's response to real year-to-year movement, so no scalar is applied.

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
    median_by_position[position] = sorted[Math.floor(sorted.length / 2)]
  }

  const dispersion_by_pid = {}
  for (const pid of Object.keys(source_totals_by_pid)) {
    const position = position_by_pid[pid]
    if (!position) continue
    dispersion_by_pid[pid] =
      measured_by_pid[pid] !== undefined
        ? measured_by_pid[pid]
        : median_by_position[position] || 0
  }

  return { dispersion_by_pid, median_by_position }
}

export default calculate_projection_dispersion
