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

// The projection relation used when a seasonlog row for the current season is
// not yet materialized: distinct REG seasons before the season, plus one, cast
// to int2 so it keeps career_year's column type.
//
// Pre-aggregated once per player rather than correlated once per outer row,
// which is what the correlated form cost: one index probe per player, on a
// probe that was already index-only and cheap individually. Same defect the
// KeepTradeCut year-axis arm carried; the cost was loop count.
//
// Anchored on the current season deliberately. The projection only ever answers
// "what career year does a player ENTER the current season in", so there is one
// such relation per query -- see the CTE alias in the emitter, which pins the
// season into the name.
export const projected_career_year_cte_select = () =>
  `select pid, (count(DISTINCT season_year) + 1)::smallint as career_year from player_seasonlogs where season_type = 'REG' and season_year < ${current_season.year} group by pid`

// Read the pre-aggregated projection for the enclosing row's player.
//
// Two invariants live here, and neither is guessable from the SQL.
//
// The COALESCE to 1 is REQUIRED. The correlated form this replaced aggregated
// over an empty set for a player with no prior REG seasonlog and returned
// `count(0) + 1 = 1`, never NULL; the grouped relation has no row for that
// player at all, so a LEFT JOIN yields NULL instead. Dropping the COALESCE
// diverges on roughly half of all players, silently -- a blank cell where a
// rookie's `1` belongs.
//
// The join onto the relation must be LEFT for that to hold. An inner join drops
// exactly the players the COALESCE exists to serve.
/**
 * @param {{ cte_alias: string }} args
 */
export const projected_career_year_from_cte = ({ cte_alias }) =>
  `COALESCE(${cte_alias}.career_year, 1::smallint)`
