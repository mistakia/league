import { current_season } from '#constants'

/**
 * The first week `process-projections` recomputes for a season.
 *
 * THIS RETURN VALUE IS A POINT-IN-TIME GUARANTEE, NOT A PERFORMANCE
 * OPTIMISATION. Do not lower it to 0 to "refresh all weeks".
 *
 * For the current season this is `current_season.week`, so completed weeks
 * (1 .. current_season.week - 1) are never revisited and their
 * `projections_index` rows keep the value they held while that week was live.
 * That is the entire mechanism by which past weekly projections are usable as
 * point-in-time features, and backtests depend on it.
 *
 * Lowering this to 0 would overwrite every completed week with today's
 * projections and destroy the point-in-time validity of every prior season. It
 * would do so silently: no error, no failing assertion elsewhere, and
 * `projections_index` carries no timestamp column, so there would be no way to
 * detect it afterwards or to tell which rows had been clobbered. The only thing
 * standing between that edit and leaked future information in a backtest is
 * this function and its spec.
 *
 * Past seasons return 0 because they are complete: there is no "current week"
 * to preserve, and a rebuild is expected to cover the whole season.
 *
 * NOT frozen by this bound, and NOT safe to treat as point-in-time:
 *   - week `0` (season-long). In the offseason `current_season.week` IS 0, so
 *     week 0 sits inside the recompute range and is rewritten every run.
 *   - `ros` / `ros_net`, which are recomputed from the remaining weeks by
 *     construction.
 *
 * See user:text/league/projection-history-system.md for the full semantic.
 *
 * @param {Object} params
 * @param {number} params.year
 * @returns {number} first week to recompute, inclusive
 */
export default function first_projection_week_to_recompute({ year }) {
  return year === current_season.year ? current_season.week : 0
}
