import {
  season_net_aggregate_key,
  rest_of_season_aggregate_key,
  rest_of_season_net_aggregate_key
} from '#libs-shared/calculate-player-period-values.mjs'
import { season_aggregate_key } from '#libs-shared/calculate-distributional-baselines.mjs'

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
 * @param {boolean} params.write_season_period - whether this run recomputed the
 *   season board, and so has a season value to write. See the seal note below.
 * @param {boolean} params.write_rest_of_season_period - whether this run is for
 *   the live year. See the rest-of-season note below.
 * @returns {object} { weekly_value_inserts, season_value_inserts,
 *   rest_of_season_value_inserts }
 */
const build_league_format_period_inserts = ({
  player_rows,
  league_format_id,
  season_year,
  write_season_period,
  write_rest_of_season_period
}) => {
  const weekly_value_inserts = []
  const season_value_inserts = []
  const rest_of_season_value_inserts = []

  // THE SEASON VALUE SEALS AT THE START OF WEEK 1. Operator ruling 2026-08-26:
  // the writer re-upserts the season row throughout the preseason and stops
  // touching it once week 1 opens, so the stored value is the FINAL preseason
  // projection rather than whichever offseason run happened to fire first.
  //
  // `write_season_period` is now a PARAMETER rather than something inferred here
  // from the week bound. It was `first_week === 0`, which was only ever correct
  // by coincidence -- it read a loop bound as if it were a period statement, so
  // raising that bound to 1 (once week 0 stopped being a projection week) would
  // have silently stopped writing this table forever, taking market_salary with
  // it. The caller states the fact directly:
  // `current_season.is_offseason || year !== current_season.year`.
  //
  // The seal is also what makes the season NET trustworthy. That net is a sum
  // over weeks 1..18, and mid-season only weeks at or after the recompute bound
  // are refreshed -- so a season row written then would sum a partial board. The
  // seal and the completeness condition are the same condition.

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
        //
        // `?? null` IS the storage spelling for "never in the drawn pool" on
        // both period tables (operator ruling 2026-09-02). Both producers leave
        // the key ABSENT for such a player rather than assigning a value, so
        // there is one condition to express and NULL is what it becomes here. It
        // replaces a `-999` on the season table and a `0` on the rest-of-season
        // one; the `0` was the worse of the two, because the positive variant is
        // floored at zero by construction and a real zero was indistinguishable
        // from an exclusion.
        projected_points_added_positive:
          pts_added[season_aggregate_key] ?? null,
        projected_points_added_net: pts_added[season_net_aggregate_key] ?? null,
        market_salary_positive: market_salary[season_aggregate_key] ?? null,
        market_salary_net: market_salary[season_net_aggregate_key] ?? null
      })
    }

    // REST OF SEASON IS CURRENT-YEAR-ONLY BY SEMANTIC, and this gate is what
    // says so. The quantity is "value from the live week to the end of the
    // year", so calculate_player_period_values sums from `current_season.week`
    // -- against a completed year that bound is meaningless and the row it
    // produces is a number nobody can interpret. The backfill wrote them anyway
    // until 2026-09-02, leaving 719 rows for 2023 and 638 for 2025 on a table
    // whose only real population is the live year.
    if (!write_rest_of_season_period) continue

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
