import { fantasy_positions } from '#constants'
import calculateBaselines from './calculate-baselines.mjs'
import calculateValues from './calculate-values.mjs'
import calculatePrices from './calculate-prices.mjs'
import calculate_distributional_baselines, {
  assign_expected_surplus,
  season_aggregate_key,
  season_projection_week
} from './calculate-distributional-baselines.mjs'

// The single entry point for turning a projection board into pts_added, for one
// week, for one league or league format.
//
// It exists because the season board and a weekly board answer different
// questions and are computed differently, and three scripts need the same
// dispatch -- process-projections.mjs (the hourly cron),
// process-projections-for-league-format.mjs (the past-season backfill) and the
// SPA's own client-side recompute. Putting the branch here means the season
// board cannot drift between them.
//
// Season (week 0): replacement level and surplus are both expectations over
// seasons drawn from each player's projection dispersion. See
// calculate-distributional-baselines.mjs for why, and for why it is season only.
//
// Weekly (weeks 1+): the point-estimate path -- rank the board, fill the
// starting slots, subtract the worst starter. Deliberately SIGNED: a weekly
// pts_added is a start/sit signal and its negative range is read directly.
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
// here. Their net variants are sums over the weekly boards this function
// produces, so they cannot exist until the weekly loop has finished;
// calculate-player-period-values.mjs owns them and prices them the same way.
const calculate_projection_values = ({
  players,
  league,
  rosterRows = [],
  week
}) => {
  const baselines = {}
  for (const position of fantasy_positions) {
    baselines[position] = { available: null, starter: null }
  }

  if (week === season_projection_week) {
    const { baselines: drawn_baselines, expected_surplus } =
      calculate_distributional_baselines({ players, league, week })

    assign_expected_surplus({ players, expected_surplus })

    for (const position of fantasy_positions) {
      const points = drawn_baselines[position]
      // No pid: replacement level is an average over draws and no real player
      // holds it. A null baseline means the league cannot fill the position at
      // all, which is a real answer and not a zero.
      baselines[position].starter =
        points === null ? null : { pid: null, points }
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

export default calculate_projection_values
