import {
  season_net_aggregate_key,
  rest_of_season_aggregate_key,
  rest_of_season_net_aggregate_key
} from '#libs-shared/calculate-player-period-values.mjs'
import {
  season_aggregate_key,
  season_projection_week
} from '#libs-shared/calculate-distributional-baselines.mjs'

// Partition one league format's computed board into the three tables that now
// hold it, one per PERIOD.
//
// This exists because the shape it replaces was period-BLIND by construction:
// both writers iterated `Object.entries(player_row.pts_added)` and pushed every
// entry into the per-week table, so the season key ('0') and the two
// rest-of-season keys landed in a `week` column beside the numeric weeks. That
// loop is the root of the sentinel encoding this cutover removes, and it lived in
// two files -- so the partition lives in one.
//
// The two callers are the hourly cron (process-projections.mjs) and the
// historical backfill (process-projections-for-league-format.mjs). They differ
// only in which year they process and how their week loop is bounded; the
// partition itself is identical, and a second spelling of it would drift.

/**
 * @param {object} params
 * @param {Array<object>} params.player_rows - carrying `pts_added` and
 *   `market_salary` maps, after the weekly loop and
 *   calculate_player_period_values have both run
 * @param {string} params.league_format_id
 * @param {number} params.season_year
 * @param {number} params.first_week - the first week the run recomputed, from
 *   first_projection_week_to_recompute. The SEASON period is written exactly
 *   when this is 0.
 * @returns {object} { weekly_value_inserts, season_value_inserts,
 *   rest_of_season_value_inserts }
 */
const build_league_format_period_inserts = ({
  player_rows,
  league_format_id,
  season_year,
  first_week
}) => {
  const weekly_value_inserts = []
  const season_value_inserts = []
  const rest_of_season_value_inserts = []

  // THE SEASON VALUE SEALS AT THE START OF WEEK 1. Operator ruling 2026-08-26:
  // the writer re-upserts the season row throughout the preseason and stops
  // touching it once week 1 opens, so the stored value is the FINAL preseason
  // projection rather than whichever offseason run happened to fire first.
  //
  // The gate is expressed through the recompute bound rather than as a separate
  // season-type check, because the two are the same fact:
  // first_projection_week_to_recompute returns current_season.week for the
  // current year, so week 0 sits inside the recompute range exactly while the
  // offseason lasts, and returns 0 for a past year, so a backfill always writes.
  // One rule, both paths, routed through the helper whose spec fails if the
  // bound is lowered.
  //
  // It is also what makes the season NET trustworthy. That net is a sum over
  // weeks 1..18, and mid-season only weeks at or after the bound are recomputed
  // -- so a season row written then would sum a partial board. The seal and the
  // completeness condition are the same condition.
  const write_season_period = first_week === season_projection_week

  for (const player_row of player_rows) {
    const pts_added = player_row.pts_added || {}
    const market_salary = player_row.market_salary || {}

    for (const [week, projected_points_added_net] of Object.entries(
      pts_added
    )) {
      // `!Number(week)` drops the season week key (0) and every named aggregate
      // key (NaN) in one test. This is the guard whose absence let 'ros' and
      // 'ros_net' reach the week column.
      if (!Number(week)) continue

      weekly_value_inserts.push({
        pid: player_row.pid,
        season_year,
        league_format_id,
        week,
        // Shorthand would key this `pts_added`, which is not the column.
        // `player_row.pts_added` is the in-memory aggregate map and keeps its
        // name; the COLUMN is projected_points_added_net (a per-week points
        // added is one signed number, so it is the net variant). The write is
        // delete-then-reinsert, so an unknown key here empties the table. The
        // weekly market salary is gone -- a price is a season-context quantity.
        projected_points_added_net
      })
    }

    if (write_season_period) {
      season_value_inserts.push({
        pid: player_row.pid,
        season_year,
        league_format_id,
        // The season POSITIVE is the drawn board -- E[max(X - baseline, 0)]
        // under the numeric season week key -- while the season NET is the sum
        // of weekly nets. They come from different computations on purpose; see
        // calculate-distributional-baselines.mjs and
        // calculate-player-period-values.mjs.
        projected_points_added_positive:
          pts_added[season_aggregate_key] ?? null,
        projected_points_added_net: pts_added[season_net_aggregate_key] ?? null,
        market_salary_positive: market_salary[season_aggregate_key] ?? null,
        market_salary_net: market_salary[season_net_aggregate_key] ?? null
      })
    }

    rest_of_season_value_inserts.push({
      pid: player_row.pid,
      season_year,
      league_format_id,
      projected_points_added_positive:
        pts_added[rest_of_season_aggregate_key] ?? null,
      projected_points_added_net:
        pts_added[rest_of_season_net_aggregate_key] ?? null,
      // The two salaries are shares of DIFFERENT pools rather than a signed
      // pair: calculate-prices derives each denominator from the positive parts
      // of its own aggregate. The token names which pool, not a sign.
      market_salary_positive:
        market_salary[rest_of_season_aggregate_key] ?? null,
      market_salary_net: market_salary[rest_of_season_net_aggregate_key] ?? null
    })
  }

  return {
    weekly_value_inserts,
    season_value_inserts,
    rest_of_season_value_inserts
  }
}

export default build_league_format_period_inserts
