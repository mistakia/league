import db from '#db'

export const from = 'team'
export const to = 'team_year'

const base_years_sql = (year_range) => {
  if (!Array.isArray(year_range) || year_range.length === 0) {
    throw new Error('team-to-team-year bridge requires non-empty year_range')
  }
  return `SELECT unnest(ARRAY[${year_range.join(',')}]::int[]) AS year`
}

const register_cte = (query_context, name, raw_sql) => {
  if (query_context.registered_ctes.has(name)) return
  query_context.players_query.with(name, db.raw(raw_sql))
  query_context.registered_ctes.add(name)
}

export const add_cte = ({ query_context }) => {
  const { year_range } = query_context
  register_cte(query_context, 'base_years', base_years_sql(year_range))
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

export default { from, to, add_cte, join_cte }
