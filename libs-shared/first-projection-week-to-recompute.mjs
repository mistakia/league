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
 * Past seasons return 1 because they are complete: there is no "current week"
 * to preserve, and a rebuild is expected to cover the whole season.
 *
 * THIS BOUND IS NEVER 0, AND THAT IS A CONTRACT RATHER THAN A CLAMP.
 * `projections_index.week` is a game week and nothing else: the season-long row
 * lives in `season_projections_index`, which has no `week` column, and
 * `CHECK (week >= 1)` makes 0 unwritable. A 0 here would build a row the table
 * rejects.
 *
 * THIS IS NOT THE SEASON PERIOD'S WRITE GATE. It used to be, by accident -- the
 * season board ran as iteration zero of the loop this bound seeds, so "the bound
 * is 0" and "write the season row" were the same fact and neither was named. The
 * season board now has its own entry point
 * (calculate_season_projection_values) and its own seal condition, stated by the
 * caller. Do not reintroduce a period meaning here.
 *
 * Still NOT frozen by this bound, and NOT safe to treat as point-in-time: the
 * rest-of-season period, which is recomputed from the remaining weeks by
 * construction.
 *
 * The current-season arm reads `active_fantasy_week` rather than flooring `week`
 * inline; `local/no-week-reconstruction` forbids re-deriving that concept
 * without naming it.
 *
 * See user:text/league/projection-history-system.md for the full semantic.
 *
 * @param {object} params
 * @param {number} params.year
 * @returns {number} first week to recompute, inclusive; always >= 1
 */
export default function first_projection_week_to_recompute({ year }) {
  return year === current_season.year ? current_season.active_fantasy_week : 1
}
