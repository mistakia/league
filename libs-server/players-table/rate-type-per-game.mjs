import get_table_hash from '../get-table-hash.mjs'
import { constants } from '#libs-shared'
import db from '#db'

export const get_per_game_cte_table_name = ({ params = {} } = {}) => {
  let year = params.year || [constants.season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  if (!year.length) {
    year = [constants.season.stats_season_year]
  }

  let week = params.week || []
  if (!Array.isArray(week)) {
    week = [week]
  }

  return get_table_hash(
    `games_played_years_${year.join('_')}_weeks_${week.join('_')}`
  )
}

export const add_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name
}) => {
  let year = params.year || [constants.season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  if (!year.length) {
    year = [constants.season.stats_season_year]
  }

  let week = params.week || []
  if (!Array.isArray(week)) {
    week = [week]
  }

  const cte_query = db('player_gamelogs')
    .select('pid')
    .leftJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .count('* as rate_type_total_count')
    .where('seas_type', 'REG')

  if (year) {
    cte_query.whereIn('year', year)
  }
  if (week.length) {
    cte_query.whereIn('week', week)
  }

  cte_query.groupBy('pid')

  players_query.with(rate_type_table_name, cte_query)
}
