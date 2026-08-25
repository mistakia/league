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
// int2 so it keeps career_year's column type. `row_alias` is the enclosing
// query's alias for the player row.
export const projected_career_year_select = ({
  table_alias = 'projected',
  row_alias = 'player',
  season_year = current_season.year
} = {}) =>
  `(SELECT (count(DISTINCT ${table_alias}.season_year) + 1)::smallint FROM player_seasonlogs as ${table_alias} WHERE ${table_alias}.pid = ${row_alias}.pid AND ${table_alias}.season_type = 'REG' AND ${table_alias}.season_year < ${season_year})`
