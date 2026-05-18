import db from '#db'
import { nfl_team_abbreviations } from '#libs-shared/constants/nfl-teams-constants.mjs'

export const from = 'team'
export const to = 'team_year'
export const mode = 'default'

const base_years_sql = (year_range) => {
  if (!Array.isArray(year_range) || year_range.length === 0) {
    throw new Error('team-to-team-year bridge requires non-empty year_range')
  }
  return `SELECT unnest(ARRAY[${year_range.join(',')}]) as year`
}

const team_values_cte_sql = () => {
  const tuples = nfl_team_abbreviations.map((code) => `('${code}')`).join(',')
  return `SELECT team_code FROM (VALUES ${tuples}) AS t(team_code)`
}

const register_cte = (query_context, name, raw_sql) => {
  if (query_context.registered_ctes.has(name)) return
  query_context.players_query.with(name, db.raw(raw_sql))
  query_context.registered_ctes.add(name)
}

export const add_cte = ({ query_context }) => {
  const { year_range } = query_context
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
