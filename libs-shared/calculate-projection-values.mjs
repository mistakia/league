import { fantasy_positions } from '#constants'
import calculateBaselines from './calculate-baselines.mjs'
import calculateValues from './calculate-values.mjs'
import calculatePrices from './calculate-prices.mjs'
import calculate_distributional_baselines, {
  assign_expected_surplus,
  season_aggregate_key
} from './calculate-distributional-baselines.mjs'

// Turning a projection board into pts_added, for one league or league format.
// TWO entry points, one per period, because the season board and a weekly board
// answer different questions and are computed differently.
//
// They were one function dispatching on `week === 0`. That sentinel is gone:
// encoding a period as a reserved week number is the same defect the dedicated
// period tables removed from the `week` column, and keeping it in memory kept it
// alive. It also fused the season computation to a LOOP BOUND -- the season
// board ran only as iteration zero of the weekly loop, so raising that loop's
// floor to 1 silently stopped producing `pts_added.season` and `market_salary`
// entirely. Naming the two paths makes the season one impossible to drop by
// moving a bound.
//
// Three scripts and the SPA share these, so both live here and neither can drift
// between them: process-projections.mjs (the hourly cron),
// process-projections-for-league-format.mjs (the past-season backfill) and the
// SPA's own client-side recompute.
//
// The two paths also produce different SETS of baselines, and that is the point
// rather than an omission. `available` -- the best player nobody has rostered --
// is a roster-aware question, and calculateBaselines answers it as a by-product
// of the same slot fill that gives it `starter`. The season board has no such
// fill: replacement level there is an expectation over drawn seasons of the
// league in a vacuum, so a season `available` would have had to come from a
// SECOND, roster-aware pass answering a different question under the same week
// key. It did, briefly, and nothing read it -- every consumer of `available`
// iterates fantasy_weeks, which starts at 1 (selected-player-value's bench+
// chart and the SPA's lineup-contribution saga). The season pass is now
// distributional only.
//
// Returns the week's baselines in a shape ready to persist. Writes pts_added
// and market_salary onto the player rows as a side effect, which is how the rest
// of the pipeline has always consumed them.
//
// PRICING RUNS HERE, for the same reason the season/weekly dispatch does. All
// four callers computed values and then immediately called calculatePrices with
// the same week, so the pairing was open-coded four times and a caller could
// compute an aggregate it never priced -- which is exactly what happened to the
// net variants. Pricing beside the computation means every aggregate this module
// writes leaves it priced. The denominator for each is derived inside
// calculate-prices.mjs from the aggregate key; nothing is passed in.
//
// The two PERIOD aggregates -- season and rest-of-season -- are not written
// here. Their net variants are sums over the weekly boards these functions
// produce, so they cannot exist until the weekly loop has finished;
// calculate-player-period-values.mjs owns them and prices them the same way.
const empty_baselines = () => {
  const baselines = {}
  for (const position of fantasy_positions) {
    baselines[position] = { available: null, starter: null }
  }
  return baselines
}

// The SEASON board: replacement level and surplus are both expectations over
// seasons drawn from each player's projection dispersion. See
// calculate-distributional-baselines.mjs for why, and for why it is season only.
//
// Runs ONCE per board, not per week. It is expensive -- roughly nine seconds per
// league format -- which is the reason the distributional model is season-only
// and never ran against the weekly boards.
//
// It produces no `available` baseline, and that is the point rather than an
// omission. `available` -- the best player nobody has rostered -- is a
// roster-aware question that calculateBaselines answers as a by-product of the
// slot fill giving it `starter`. The season board has no such fill: replacement
// level here is an expectation over drawn seasons of the league in a vacuum. A
// season `available` would need a SECOND, roster-aware pass answering a
// different question under the same key. It did, briefly, and nothing read it --
// every consumer of `available` iterates fantasy_weeks, which starts at 1.
export const calculate_season_projection_values = ({ players, league }) => {
  const baselines = empty_baselines()

  const { baselines: drawn_baselines, expected_surplus } =
    calculate_distributional_baselines({ players, league })

  assign_expected_surplus({ players, expected_surplus })

  for (const position of fantasy_positions) {
    const points = drawn_baselines[position]
    // No pid: replacement level is an average over draws and no real player
    // holds it. A null baseline means the league cannot fill the position at
    // all, which is a real answer and not a zero.
    baselines[position].starter = points === null ? null : { pid: null, points }
  }

  // One aggregate at season grain, so one price. The season NET is a sum of
  // weekly-grain nets and therefore cannot be computed here -- the weekly
  // boards do not exist yet -- so it and its price belong to
  // calculate-player-period-values.mjs, which runs after the weekly loop.
  calculatePrices({
    league_format: league,
    players,
    aggregate_key: season_aggregate_key
  })

  return { baselines }
}

// A WEEKLY board (weeks 1+): the point-estimate path -- rank the board, fill the
// starting slots, subtract the worst starter. Deliberately SIGNED: a weekly
// pts_added is a start/sit signal and its negative range is read directly.
export const calculate_weekly_projection_values = ({
  players,
  league,
  rosterRows = [],
  week
}) => {
  const baselines = empty_baselines()

  const point_estimate_baselines = calculateBaselines({
    players,
    league,
    rosterRows,
    week
  })

  calculateValues({
    players,
    baselines: point_estimate_baselines,
    week
  })

  for (const position of fantasy_positions) {
    const { available, starter } = point_estimate_baselines[position]
    baselines[position].available = available
      ? {
          pid: available.pid,
          points: (available.points[week] || {}).total ?? null
        }
      : null
    baselines[position].starter = starter
      ? { pid: starter.pid, points: (starter.points[week] || {}).total ?? null }
      : null
  }

  // A weekly pts_added is already signed -- it is a start/sit signal whose
  // negative range is read directly -- so there is one weekly aggregate, not
  // two, and the positive-part denominator is what keeps its negative half out
  // of the rate.
  calculatePrices({ league_format: league, players, aggregate_key: week })

  return { baselines }
}
