export const add_week_opponent_cte_tables = ({
  players_query,
  table_name,
  week,
  year,
  seas_type = 'REG'
}) => {
  players_query.with(table_name, (qb) => {
    qb.select('h as nfl_team', 'v as opponent')
      .from('public.nfl_games')
      .where({
        year,
        week,
        seas_type
      })
      .union((qb) => {
        qb.select('v as nfl_team', 'h as opponent')
          .from('public.nfl_games')
          .where({
            year,
            week,
            seas_type
          })
      })
  })
  return players_query
}
