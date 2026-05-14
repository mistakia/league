import db from '#db'

export const from = 'player'
export const to = 'player_year'

const base_years_sql = (year_range) => {
  if (!Array.isArray(year_range) || year_range.length === 0) {
    throw new Error(
      'player-to-player-year bridge requires non-empty year_range'
    )
  }
  return `SELECT unnest(ARRAY[${year_range.join(',')}]) as year`
}

const register_cte = (query_context, name, raw_sql) => {
  if (query_context.registered_ctes.has(name)) return
  query_context.players_query.with(name, db.raw(raw_sql))
  query_context.registered_ctes.add(name)
}

export const add_cte = ({ query_context }) => {
  const { year_range, position_filter_sql } = query_context
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

export default { from, to, add_cte, join_cte }
