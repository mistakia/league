// @ts-check
import { current_season } from '#constants'

// =============================================================================
// SINGLE DECLARED DEFINITION of player_seasonlogs.career_year
//
// career_year(pid, season_year) = 1 + (number of distinct regular-season years
// strictly before season_year in which pid recorded a REG gamelog).
//
// It is a function of season_year alone and is independent of season_type: a
// preseason, regular and postseason seasonlog row for the same (pid,
// season_year) carry the same value. A preseason-only season (no REG/POST that
// year) gets `prior REG seasons + 1`, never NULL/0, so it stays findable under
// a career-year filter -- the Wheatley Jr NULL precedent is superseded by this
// ruling.
//
// This is the projection rule the data-view column defs already used for the
// current season. Declared once here so the materializer
// (scripts/generate-player-career-game-counts.mjs) and the emitter
// (libs-server/data-views-column-definitions/player-seasonlogs-column-definitions.mjs)
// derive from the same definition instead of reimplementing it.
// =============================================================================

// The career year a player occupies in a season whose prior REG-season count is
// known. `distinct_prior_reg_seasons` is the number of distinct regular-season
// years < the season in which the player recorded a REG gamelog.
/**
 * @param {number} distinct_prior_reg_seasons
 */
export const career_year_from_distinct_prior_reg_seasons = (
  distinct_prior_reg_seasons
) => distinct_prior_reg_seasons + 1

// The projection SQL used when a seasonlog row for the (current) season is not
// yet materialized: distinct REG seasons before the season, plus one, cast to
// int2 so it keeps career_year's column type.
//
// Pre-aggregated once per player rather than correlated once per outer row.
// The correlated form was a subquery on the enclosing player row, so it cost
// one index probe per player -- 28,807 loops and 86,461 buffers, 46% of an
// otherwise-optimized multi-year player-year plan, measured on production
// 2026-08-29. Grouped, the same answer costs 1,484 buffers, a 58x reduction.
// This is the same defect the KeepTradeCut year-axis arm carried: the probes
// were already index-only and cheap individually, and the cost was loop count.
export const projected_career_year_cte_select = ({
  season_year = current_season.year
} = {}) =>
  `select pid, (count(DISTINCT season_year) + 1)::smallint as career_year from player_seasonlogs where season_type = 'REG' and season_year < ${season_year} group by pid`

// Read the pre-aggregated projection for the enclosing row's player.
//
// The COALESCE to 1 is REQUIRED and is the whole correctness content of this
// rewrite. The correlated form aggregated over an empty set for a player with
// no prior REG seasonlog and returned `count(0) + 1 = 1`, never NULL; the
// grouped relation has no row for that player at all, so the LEFT JOIN yields
// NULL instead. Without the COALESCE the two forms diverge on 16,536 of 28,807
// players, and the divergence is silent -- a blank cell where a rookie's `1`
// belongs. Verified equivalent at 28,807 rows with zero symmetric difference in
// both directions on production 2026-08-29.
//
// The join onto the CTE must be a LEFT join for this to hold; an inner join
// would drop those 16,536 players from the view entirely.
/**
 * @param {{ cte_alias: string }} args
 */
export const projected_career_year_from_cte = ({ cte_alias }) =>
  `COALESCE(${cte_alias}.career_year, 1::smallint)`
