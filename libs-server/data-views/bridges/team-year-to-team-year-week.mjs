import db from '#db'

export const from = 'team_year'
export const to = 'team_year_week'

export const add_cte = ({ query_context }) => {
  const { year_range } = query_context
  if (query_context.registered_ctes.has('team_years_weeks')) return
  const single_year = year_range.length === 1 ? year_range[0] : null
  const where = single_year
    ? ` WHERE nfl_year_week_timestamp.year = ${single_year}`
    : ''
  query_context.players_query.with(
    'team_years_weeks',
    db.raw(
      `SELECT team_years.team_code, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM team_years INNER JOIN nfl_year_week_timestamp ON team_years.year = nfl_year_week_timestamp.year${where}`
    )
  )
  query_context.registered_ctes.add('team_years_weeks')
}

export const join_cte = ({ query_context }) => {
  const { players_query } = query_context
  players_query.innerJoin('team_years_weeks', function () {
    this.on('team_years_weeks.team_code', 'team.team_code')
    this.andOn('team_years_weeks.year', 'team_years.year')
  })
}

export default { from, to, add_cte, join_cte }
