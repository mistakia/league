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

  let year_offset = params.year_offset || []
  if (!Array.isArray(year_offset)) {
    year_offset = [year_offset]
  }

  const adjusted_years = year.flatMap((y) => {
    const base_year = Number(y)
    if (year_offset.length === 2) {
      // If year_offset is a range
      const max_offset = Math.max(...year_offset.map(Number))
      const min_offset = Math.min(...year_offset.map(Number))
      return Array.from(
        { length: max_offset - min_offset + 1 },
        (_, i) => base_year + min_offset + i
      )
    } else {
      return base_year + Number(year_offset)
    }
  })

  const all_years = [...new Set([...year, ...adjusted_years])].sort(
    (a, b) => a - b
  )

  return get_table_hash(
    `games_played_years_${all_years.join('_')}_weeks_${week.join('_')}`
  )
}

export const add_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits = []
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
    .where('active', true)

  if (year) {
    cte_query.whereIn('year', year)
  }
  if (week.length) {
    cte_query.whereIn('week', week)
  }

  for (const split of splits) {
    if (split === 'year') {
      cte_query.select('year')
      cte_query.groupBy('year')
    }
  }

  cte_query.groupBy('pid')

  players_query.with(rate_type_table_name, cte_query)
}
