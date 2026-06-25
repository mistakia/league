import db from '#db'
import { current_season } from '#constants'
import { team_values_cte_sql } from '#libs-server/data-views/team-values-cte.mjs'

export const from = 'team'
export const to = 'team_year'
export const mode = 'default'

// Bridges may run with an empty query_context.year_range when a team-cell
// column attaches a team_year-grain source with no year/week row-axis (e.g. a
// season team-stat column carrying an explicit `year` param on a no-row-axes
// team view). get_year_range only populates query_context.year_range on the
// row-axes branch, so without this fallback such a view throws at build time.
// Mirror player_year->team_year's resolution order:
//   1. query_context.year_range (year/week row-axis present)
//   2. params.year (explicit per-column override)
//   3. source.year_default(params) (the attaching source's anchor year)
//   4. current_season.year (defensive)
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

const base_years_sql = (year_range) => {
  if (!Array.isArray(year_range) || year_range.length === 0) {
    throw new Error('team-to-team-year bridge requires non-empty year_range')
  }
  return `SELECT unnest(ARRAY[${year_range.join(',')}]) as year`
}

const register_cte = (query_context, name, raw_sql) => {
  if (query_context.registered_ctes.has(name)) return
  query_context.players_query.with(name, db.raw(raw_sql))
  query_context.registered_ctes.add(name)
}

export const add_cte = ({ query_context, params = {}, source = null }) => {
  const year_range = resolve_year_range({ query_context, params, source })
  // Order matters: Postgres CTEs may only reference siblings declared
  // earlier in the WITH list. team_years references team, so team must
  // be registered first even when the team identity's from_source would
  // otherwise add it later via setup_from_table_and_player_joins.
  register_cte(query_context, 'base_years', base_years_sql(year_range))
  register_cte(query_context, 'team', team_values_cte_sql())
  register_cte(
    query_context,
    'team_years',
    'SELECT team.team_code, base_years.year FROM team CROSS JOIN base_years'
  )
}

export const join_cte = ({ query_context }) => {
  const { players_query } = query_context
  players_query.innerJoin(
    'team_years',
    'team_years.team_code',
    'team.team_code'
  )
}

export default { from, to, mode, add_cte, join_cte }
