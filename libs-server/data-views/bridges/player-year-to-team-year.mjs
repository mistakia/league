import db from '#db'
import { current_season } from '#constants'

export const from = 'player_year'
export const to = 'team_year'

const CTE_NAME = 'player_year_teams'

export const add_cte = ({ query_context }) => {
  const { players_query, year_range } = query_context
  const inner_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .select('nfl_games.year')
    .select('player_gamelogs.tm')
    .count('* as game_count')
    .innerJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.seas_type', 'REG')
    .whereIn('nfl_games.year', year_range)
    .whereIn('player_gamelogs.year', year_range)
    .groupBy('player_gamelogs.pid', 'nfl_games.year', 'player_gamelogs.tm')

  const cte_query = db
    .select('pid')
    .select('year')
    .select(
      db.raw('(array_agg(tm ORDER BY game_count DESC, tm ASC))[1] as team')
    )
    .from(inner_query.as('player_year_team_counts'))
    .groupBy('pid', 'year')

  players_query.withMaterialized(CTE_NAME, cte_query)
  query_context.player_year_teams_cte_name = CTE_NAME
  query_context.player_year_teams_year_range = year_range
}

export const join_cte = ({ query_context }) => {
  const { players_query, splits, pid_reference, year_reference, year_range } =
    query_context
  players_query.leftJoin(CTE_NAME, function () {
    this.on(`${CTE_NAME}.pid`, '=', pid_reference)
    if (splits.includes('year') && year_reference) {
      this.andOn(`${CTE_NAME}.year`, '=', year_reference)
    } else {
      const join_year =
        year_range.length > 0 ? Math.max(...year_range) : current_season.year
      this.andOn(`${CTE_NAME}.year`, '=', db.raw('?', [join_year]))
    }
  })
}

export default { from, to, add_cte, join_cte }
