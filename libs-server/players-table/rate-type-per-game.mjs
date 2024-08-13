import get_table_hash from '../get-table-hash.mjs'
import db from '#db'

export const get_per_game_cte_table_name = ({ params = {} } = {}) => {
  let year = params.year || []
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || []
  if (!Array.isArray(week)) {
    week = [week]
  }

  let year_offset = params.year_offset || []
  if (!Array.isArray(year_offset)) {
    year_offset = [year_offset]
  }

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) {
    career_year = [career_year]
  }

  let career_game = params.career_game || []
  if (!Array.isArray(career_game)) {
    career_game = [career_game]
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
      return [base_year + Number(year_offset[0])]
    } else {
      return [base_year]
    }
  })

  const all_years = year.length
    ? [...new Set([...year, ...adjusted_years])].sort((a, b) => a - b)
    : []

  return get_table_hash(
    `games_played_years_${all_years.join('_')}_weeks_${week.join('_')}_career_year_${career_year.join('_')}_career_game_${career_game.join('_')}`
  )
}

export const add_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits = []
}) => {
  let year = params.year || []
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || []
  if (!Array.isArray(week)) {
    week = [week]
  }

  let year_offset = params.year_offset || []
  if (!Array.isArray(year_offset)) {
    year_offset = [year_offset]
  }

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) {
    career_year = [career_year]
  }

  let career_game = params.career_game || []
  if (!Array.isArray(career_game)) {
    career_game = [career_game]
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

  const all_years = year.length
    ? [...new Set([...year, ...adjusted_years])].sort((a, b) => a - b)
    : []

  let cte_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .leftJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .count('* as rate_type_total_count')
    .where('nfl_games.seas_type', 'REG')
    .where('player_gamelogs.active', true)

  if (career_year.length) {
    cte_query = cte_query.leftJoin('player_seasonlogs', function () {
      this.on('player_seasonlogs.pid', 'player_gamelogs.pid')
      this.andOn('player_seasonlogs.year', 'nfl_games.year')
      this.andOn('player_seasonlogs.seas_type', 'nfl_games.seas_type')
    })
  }

  if (all_years.length) {
    cte_query.whereIn('nfl_games.year', all_years)
  }

  if (week.length) {
    cte_query.whereIn('nfl_games.week', week)
  }

  if (career_year.length === 2) {
    const min_career_year = Math.min(...career_year.map(Number))
    const max_career_year = Math.max(...career_year.map(Number))
    cte_query.whereBetween('player_seasonlogs.career_year', [
      min_career_year,
      max_career_year
    ])
  }

  if (career_game.length === 2) {
    const min_career_game = Math.min(...career_game.map(Number))
    const max_career_game = Math.max(...career_game.map(Number))
    cte_query.whereBetween('player_gamelogs.career_game', [
      min_career_game,
      max_career_game
    ])
  }

  for (const split of splits) {
    if (split === 'year') {
      cte_query.select('nfl_games.year')
      cte_query.groupBy('nfl_games.year')
    }
  }

  cte_query.groupBy('player_gamelogs.pid')

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
