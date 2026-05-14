import db from '#db'

export const from = 'player_year'
export const to = 'player_year_week'

export const add_cte = ({ query_context }) => {
  const { year_range } = query_context
  if (query_context.registered_ctes.has('player_years_weeks')) return
  const single_year = year_range.length === 1 ? year_range[0] : null
  const where = single_year
    ? ` WHERE nfl_year_week_timestamp.year = ${single_year}`
    : ''
  query_context.players_query.with(
    'player_years_weeks',
    db.raw(
      `SELECT player_years.pid, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM player_years INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year${where}`
    )
  )
  query_context.registered_ctes.add('player_years_weeks')
}

export const join_cte = ({ query_context }) => {
  const { players_query, splits = [] } = query_context
  const join_on_year = splits.includes('year')
  players_query.innerJoin('player_years_weeks', function () {
    this.on('player_years_weeks.pid', 'player.pid')
    if (join_on_year) {
      this.on('player_years_weeks.year', 'player_years.year')
    }
  })
}

export default { from, to, add_cte, join_cte }
