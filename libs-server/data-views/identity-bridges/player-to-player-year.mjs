import db from '#db'
import { current_season } from '#constants'

export const from = 'player'
export const to = 'player_year'
export const mode = 'default'

// Bridges may run with empty query_context.year_range (player-cell column with
// no year split). Mirror the resolve_year_range used by player-year-to-team-year
// so the bridge still has a concrete year set to UNNEST.
const resolve_year_range = ({ query_context, params }) => {
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
  return [current_season.year]
}

const base_years_sql = (year_range) =>
  `SELECT unnest(ARRAY[${year_range.join(',')}]) as year`

const register_cte = (query_context, name, raw_sql) => {
  if (query_context.registered_ctes.has(name)) return
  query_context.players_query.with(name, db.raw(raw_sql))
  query_context.registered_ctes.add(name)
}

export const add_cte = ({ query_context, params = {} }) => {
  const { position_filter_sql } = query_context
  const year_range = resolve_year_range({ query_context, params })
  register_cte(query_context, 'base_years', base_years_sql(year_range))
  const where = position_filter_sql ? ` WHERE ${position_filter_sql}` : ''
  register_cte(
    query_context,
    'player_years',
    `SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years${where}`
  )
}

export const join_cte = ({ query_context }) => {
  const { players_query } = query_context
  players_query.innerJoin('player_years', 'player_years.pid', 'player.pid')
}

export default { from, to, mode, add_cte, join_cte }
