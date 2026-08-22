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

// Joined into the outer FROM only when the year axis runs WITHOUT a week axis.
// Under a week axis the player_year_week bridge joins player_years_weeks, which
// is built from player_years and so already carries the (pid, year) pair of
// exactly one player_years row -- and the identity's year_column is
// player_years_weeks.year, so nothing in the outer query reads player_years at
// all. Joining it anyway was redundant, and expensive: both CTEs are opaque to
// the planner, so a two-column (pid, year) correlation multiplied two
// independent selectivity estimates and produced a nested loop. Measured on
// production 2026-08-21, a single-year week split estimated 1,188 rows against
// 506,322 actual and ran 295M join-filter comparisons; dropping this join and
// the week bridge's year correlation took the statement from 35.9s to 1.1s.
//
// The guard lives here rather than at the call sites so both of them --
// setup_from_table_and_player_joins and build-period-cte's
// ensure_split_bridges -- inherit it. add_cte still registers the CTE
// unconditionally, since player_years_weeks selects from it.
export const join_cte = ({ query_context }) => {
  const { players_query, row_axes = [] } = query_context
  if (row_axes.includes('week')) return
  players_query.innerJoin('player_years', 'player_years.pid', 'player.pid')
}

export default { from, to, mode, add_cte, join_cte }
