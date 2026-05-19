import db from '#db'
import { current_season } from '#constants'

export const from = 'player_year'
export const to = 'team_year'
export const mode = 'default'

const CTE_NAME = 'player_year_teams'

// Mirror resolve_nfl_week_id_from_year_param's seas_type default: when no
// explicit value is supplied, REG is the canonical fallback. Reading from
// params lets a future "POST plays" data view flow through unchanged.
const resolve_seas_type = (params = {}) => {
  if (Array.isArray(params.seas_type) && params.seas_type.length) {
    return params.seas_type
  }
  if (params.seas_type) return [params.seas_type]
  return ['REG']
}

// Bridges may run in contexts where query_context.year_range is empty
// (player-cell + team_year-source attach with no year split). Resolution
// order:
//   1. query_context.year_range (year/week split present)
//   2. params.year (explicit per-column override)
//   3. source.year_default(params) -- the attaching source's anchor year
//      (e.g. ESPN team-stats default to current_season.stats_season_year)
//   4. current_season.year (no source context; defensive)
// Without step 3 the historical-team CTE was built for current_season.year
// (e.g. 2026 in-offseason) and the source attach found no rows -- causing
// every team-year stat to return null for active players.
const resolve_year_range = ({ query_context, params, source }) => {
  if (
    Array.isArray(query_context.year_range) &&
    query_context.year_range.length > 0
  ) {
    return query_context.year_range
  }
  if (params && params.year != null) {
    const year_array = Array.isArray(params.year) ? params.year : [params.year]
    const parsed = year_array
      .map((y) => parseInt(y, 10))
      .filter((y) => Number.isFinite(y))
    if (parsed.length > 0) {
      return Array.from(new Set(parsed)).sort((a, b) => a - b)
    }
  }
  if (source && typeof source.year_default === 'function') {
    const v = source.year_default(params || {})
    if (v != null) {
      const arr = Array.isArray(v) ? v : [v]
      const parsed = arr
        .map((y) => parseInt(y, 10))
        .filter((y) => Number.isFinite(y))
      if (parsed.length > 0) {
        return Array.from(new Set(parsed)).sort((a, b) => a - b)
      }
    }
  }
  return [current_season.year]
}

export const add_cte = ({ query_context, params = {}, source = null }) => {
  const { players_query } = query_context
  const year_range = resolve_year_range({ query_context, params, source })

  const inner_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .select('nfl_games.year')
    .select('player_gamelogs.tm')
    .count('* as game_count')
    .innerJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .whereIn('nfl_games.seas_type', resolve_seas_type(params))
    .whereIn('nfl_games.year', year_range)
    .whereIn('player_gamelogs.year', year_range)
    .groupBy('player_gamelogs.pid', 'nfl_games.year', 'player_gamelogs.tm')

  const cte_query = db
    .select('pid')
    .select('year')
    .select(
      db.raw('(array_agg(tm ORDER BY game_count DESC, tm ASC))[1] as team')
    )
    .from(inner_query.as('player_year_team_counts'))
    .groupBy('pid', 'year')

  players_query.withMaterialized(CTE_NAME, cte_query)
  query_context.player_year_teams_cte_name = CTE_NAME
  query_context.player_year_teams_year_range = year_range
}

export const join_cte = ({ query_context, params = {}, source = null }) => {
  const { players_query, splits, pid_reference, year_reference } = query_context
  const year_range = resolve_year_range({ query_context, params, source })
  players_query.leftJoin(CTE_NAME, function () {
    this.on(`${CTE_NAME}.pid`, '=', pid_reference)
    if (splits.includes('year') && year_reference) {
      this.andOn(`${CTE_NAME}.year`, '=', year_reference)
    } else {
      const join_year =
        year_range.length > 0 ? Math.max(...year_range) : current_season.year
      this.andOn(`${CTE_NAME}.year`, '=', db.raw('?', [join_year]))
    }
  })
}

export default { from, to, mode, add_cte, join_cte }
