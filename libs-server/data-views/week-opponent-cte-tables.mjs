export const add_week_opponent_cte_tables = ({
  players_query,
  table_name,
  week,
  season_year,
  season_type = 'REG'
}) => {
  players_query.with(table_name, (qb) => {
    qb.select('home_nfl_team as nfl_team', 'away_nfl_team as opponent')
      .from('public.nfl_games')
      .where({
        season_year,
        week,
        season_type
      })
      .union((qb) => {
        qb.select('away_nfl_team as nfl_team', 'home_nfl_team as opponent')
          .from('public.nfl_games')
          .where({
            season_year,
            week,
            season_type
          })
      })
  })
  return players_query
}
