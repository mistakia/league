import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'

export const get_per_player_cte_table_name = ({
  params = {},
  stat_type = null,
  rate_type_params = {}
} = {}) => {
  let year = params.year || []
  if (!Array.isArray(year)) {
    year = [year]
  }

  let year_offset = params.year_offset || []
  if (!Array.isArray(year_offset)) {
    year_offset = [year_offset]
  }

  let week = params.week || []
  if (!Array.isArray(week)) {
    week = [week]
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

  const stat_type_suffix = stat_type ? `_${stat_type}` : ''
  const column_params_suffix = Object.entries(rate_type_params)
    .map(([key, value]) => `_${key}_${value}`)
    .join('')

  return get_table_hash(
    `per_player${stat_type_suffix}${column_params_suffix}_years_${all_years.join('_')}_weeks_${week.join('_')}`
  )
}

export const add_per_player_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits,
  stat_type,
  rate_type_params = {}
}) => {
  const cte_query = db('nfl_plays')
    .where('nfl_plays.seas_type', 'REG')
    .whereNot('play_type', 'NOPL')

  let count_expression = 'COUNT(*)'
  switch (stat_type) {
    case 'rush_attempt':
      count_expression = `SUM(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE 0 END)`
      cte_query.select('nfl_plays.bc_pid as pid')
      cte_query.groupBy('nfl_plays.bc_pid')
      break
    case 'pass_attempt':
      count_expression = `SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END)`
      cte_query.select('nfl_plays.psr_pid as pid')
      cte_query.groupBy('nfl_plays.psr_pid')
      break
    case 'target':
      count_expression = `SUM(CASE WHEN trg_pid IS NOT NULL THEN 1 ELSE 0 END)`
      cte_query.select('nfl_plays.trg_pid as pid')
      cte_query.groupBy('nfl_plays.trg_pid')
      break
  }

  cte_query.select(db.raw(`${count_expression} as rate_type_total_count`))

  for (const split of splits) {
    if (split === 'year') {
      cte_query.select('nfl_plays.year')
      cte_query.groupBy('nfl_plays.year')
    } else if (split === 'week') {
      cte_query.select('nfl_plays.week')
      cte_query.groupBy('nfl_plays.week')
    }
  }

  // TODO not sure if the column params should be applied to the the rate type as well

  // Remove career_year and career_game from params before applying other filters
  const filtered_params = {
    year: params.year,
    week: params.week,
    year_offset: params.year_offset,
    week_offset: params.week_offset,
    ...rate_type_params
  }
  // delete filtered_params.career_year
  // delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: cte_query,
    params: filtered_params
  })

  players_query.with(rate_type_table_name, cte_query)
}

export const join_per_player_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits,
  year_split_join_clause
}) => {
  const year_offset = params.year_offset
  const has_year_offset_range =
    year_offset &&
    Array.isArray(year_offset) &&
    year_offset.length > 1 &&
    year_offset[0] !== year_offset[1]
  const has_single_year_offset =
    year_offset &&
    ((Array.isArray(year_offset) &&
      (year_offset.length === 1 || year_offset[0] === year_offset[1])) ||
      typeof year_offset === 'number')

  players_query.leftJoin(rate_type_table_name, function () {
    this.on(`${rate_type_table_name}.pid`, 'player.pid')

    if (splits.includes('year') && year_split_join_clause) {
      if (has_year_offset_range) {
        const min_offset = Math.min(...year_offset)
        const max_offset = Math.max(...year_offset)
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

    if (splits.includes('week')) {
      this.on(`${rate_type_table_name}.week`, '=', 'player_weeks.week')
    }
  })
}
