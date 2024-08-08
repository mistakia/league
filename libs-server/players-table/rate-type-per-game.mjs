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
    } else if (year_offset.length === 1) {
      // If year_offset is a single number
      return [base_year + Number(year_offset[0])]
    } else {
      return [base_year]
    }
  })

  const all_years = [...new Set([...year, ...adjusted_years])].sort(
    (a, b) => a - b
  )

  const cte_query = db('player_gamelogs')
    .select('pid')
    .leftJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .count('* as rate_type_total_count')
    .where('seas_type', 'REG')
    .where('active', true)

  cte_query.whereIn('year', all_years)

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

export const join_per_game_cte = ({
  players_query,
  rate_type_table_name,
  splits,
  year_split_join_clause,
  params
}) => {
  const year_offset = params.year_offset
  const has_year_offset_range =
    year_offset &&
    Array.isArray(year_offset) &&
    year_offset.length > 1 &&
    year_offset[0] !== year_offset[1]
  const has_single_year_offset =
    year_offset &&
    ((Array.isArray(year_offset) && year_offset.length === 1) ||
      typeof year_offset === 'number')

  players_query.leftJoin(rate_type_table_name, function () {
    this.on(`${rate_type_table_name}.pid`, 'player.pid')

    if (splits.includes('year') && year_split_join_clause) {
      if (has_year_offset_range) {
        const min_offset = Math.min(year_offset[0], year_offset[1])
        const max_offset = Math.max(year_offset[0], year_offset[1])
        this.on(
          db.raw(
            `${rate_type_table_name}.year BETWEEN player_years.year + ? AND player_years.year + ?`,
            [min_offset, max_offset]
          )
        )
      } else if (has_single_year_offset) {
        const offset = Array.isArray(year_offset) ? year_offset[0] : year_offset
        this.on(
          db.raw(`${rate_type_table_name}.year = player_years.year + ?`, [
            offset
          ])
        )
      } else {
        const single_year_param_set =
          params.year &&
          (Array.isArray(params.year) ? params.year.length === 1 : true)
        if (single_year_param_set) {
          const specific_year = Array.isArray(params.year)
            ? params.year[0]
            : params.year
          this.andOn(
            `${rate_type_table_name}.year`,
            '=',
            db.raw('?', [specific_year])
          )
        } else {
          this.on(`${rate_type_table_name}.year`, year_split_join_clause)
        }
      }
    }
  })
}
