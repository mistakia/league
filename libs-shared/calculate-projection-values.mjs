import { fantasy_positions } from '#constants'
import calculateBaselines from './calculate-baselines.mjs'
import calculateValues from './calculate-values.mjs'
import calculate_distributional_baselines, {
  assign_expected_surplus,
  season_projection_week
} from './calculate-distributional-baselines.mjs'

// The single entry point for turning a projection board into pts_added, for one
// week, for one league or league format.
//
// It exists because the season board and a weekly board answer different
// questions and are computed differently, and three scripts need the same
// dispatch -- process-projections.mjs (the 30-minute cron),
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
// Returns the total positive pts_added (the denominator calculate-prices divides
// the discretionary cap by) and the week's baselines in a shape ready to
// persist. Writes pts_added onto the player rows as a side effect, which is how
// the rest of the pipeline has always consumed it.
const calculate_projection_values = ({
  players,
  league,
  rosterRows = [],
  week
}) => {
  // The 'available' baseline -- the best player nobody has -- is a roster-aware
  // question and is unchanged by this rebuild, so it comes from the point-
  // estimate pass at every week including the season board.
  const point_estimate_baselines = calculateBaselines({
    players,
    league,
    rosterRows,
    week
  })

  const baselines = {}
  for (const position of fantasy_positions) {
    const available = point_estimate_baselines[position].available
    baselines[position] = {
      available: available
        ? {
            pid: available.pid,
            points: (available.points[week] || {}).total ?? null
          }
        : null,
      starter: null
    }
  }

  if (week === season_projection_week) {
    const {
      baselines: drawn_baselines,
      expected_surplus,
      total_pts_added
    } = calculate_distributional_baselines({ players, league, week })

    assign_expected_surplus({ players, expected_surplus, week })

    for (const position of fantasy_positions) {
      const points = drawn_baselines[position]
      // No pid: replacement level is an average over draws and no real player
      // holds it. A null baseline means the league cannot fill the position at
      // all, which is a real answer and not a zero.
      baselines[position].starter =
        points === null ? null : { pid: null, points }
    }

    return { total_pts_added, baselines }
  }

  const total_pts_added = calculateValues({
    players,
    baselines: point_estimate_baselines,
    week
  })

  for (const position of fantasy_positions) {
    const starter = point_estimate_baselines[position].starter
    baselines[position].starter = starter
      ? { pid: starter.pid, points: (starter.points[week] || {}).total ?? null }
      : null
  }

  return { total_pts_added, baselines }
}

export default calculate_projection_values
