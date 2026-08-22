import db from '#db'

export const from = 'player_year'
export const to = 'player_year_week'
export const mode = 'default'

export const add_cte = ({ query_context }) => {
  const { year_range, week_range = [] } = query_context
  if (query_context.registered_ctes.has('player_years_weeks')) return
  const single_year = year_range.length === 1 ? year_range[0] : null
  const filters = []
  if (single_year) {
    filters.push(`nfl_year_week_timestamp.year = ${single_year}`)
  }
  if (week_range.length) {
    filters.push(`nfl_year_week_timestamp.week IN (${week_range.join(', ')})`)
  }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
  query_context.players_query.with(
    'player_years_weeks',
    db.raw(
      `SELECT player_years.pid, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM player_years INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year${where}`
    )
  )
  query_context.registered_ctes.add('player_years_weeks')
}

// pid alone. player_years_weeks is built as player_years INNER JOIN
// nfl_year_week_timestamp ON year, so every one of its rows already carries the
// (pid, year) pair of exactly one player_years row -- correlating the outer join
// on year as well matched the same rows and changed no result.
//
// It was not free. Both CTEs are opaque to the planner, so joining them on two
// columns made it multiply two independent selectivity estimates: measured on
// production 2026-08-21, a single-year week split estimated 1,188 rows where
// 506,322 came back, and the resulting nested loop against the fact CTE ran
// 295M join-filter comparisons. Dropping the correlation took the same
// statement from 35.9s to 1.1s. setup_from_table_and_player_joins skips the
// player_years outer join entirely under a week axis for the same reason; the
// CTE stays registered because this one selects from it.
export const join_cte = ({ query_context }) => {
  const { players_query } = query_context
  players_query.innerJoin(
    'player_years_weeks',
    'player_years_weeks.pid',
    'player.pid'
  )
}

export default { from, to, mode, add_cte, join_cte }
