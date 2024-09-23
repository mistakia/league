import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'

export const get_per_team_play_cte_table_name = ({
  params = {},
  play_type = null,
  group_by = null,
  team_unit = 'off'
} = {}) => {
  team_unit = params.team_unit || team_unit

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

  const play_type_suffix = play_type ? `_${play_type.toLowerCase()}` : ''
  const group_by_suffix = group_by ? `_${group_by}` : ''
  const team_type_suffix = team_unit === 'def' ? '_def' : '_off'
  return get_table_hash(
    `per_team_play${play_type_suffix}${group_by_suffix}${team_type_suffix}_years_${all_years.join('_')}_weeks_${week.join('_')}`
  )
}

export const add_per_team_play_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits,
  play_type = null,
  group_by = null,
  team_unit = 'off'
}) => {
  team_unit = params.team_unit || team_unit

  const cte_query = db('nfl_plays')
    .select(`nfl_plays.${team_unit}`)
    .where('nfl_plays.seas_type', 'REG')
    .whereNot('play_type', 'NOPL')
    .groupBy(`nfl_plays.${team_unit}`)

  let count_expression = 'COUNT(*)'
  if (group_by) {
    switch (group_by) {
      case 'half':
        count_expression =
          'COUNT(DISTINCT CONCAT(nfl_plays.esbid, CASE WHEN qtr <= 2 THEN 1 ELSE 2 END))'
        break
      case 'quarter':
        count_expression = 'COUNT(DISTINCT CONCAT(nfl_plays.esbid, qtr))'
        break
      case 'drive':
        count_expression = 'COUNT(DISTINCT CONCAT(nfl_plays.esbid, drive_seq))'
        break
      case 'series':
        count_expression = 'COUNT(DISTINCT CONCAT(nfl_plays.esbid, series_seq))'
        break
    }
  }

  cte_query.select(db.raw(`${count_expression} as rate_type_total_count`))

  if (play_type) {
    cte_query.where('play_type', play_type)
  } else {
    cte_query.whereIn('play_type', ['PASS', 'RUSH'])
  }

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
    week_offset: params.week_offset
  }
  // delete filtered_params.career_year
  // delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: cte_query,
    params: filtered_params
  })

  players_query.with(rate_type_table_name, cte_query)
}

export const join_per_team_play_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits,
  year_split_join_clause,
  group_by = null,
  team_unit = 'off'
}) => {
  team_unit = params.team_unit || team_unit

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
    const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
      ? params.matchup_opponent_type[0] &&
        typeof params.matchup_opponent_type[0] === 'object'
        ? null
        : params.matchup_opponent_type[0]
      : params.matchup_opponent_type
    if (matchup_opponent_type) {
      switch (matchup_opponent_type) {
        case 'current_week_opponent_total':
          this.on(
            `${rate_type_table_name}.${team_unit}`,
            'current_week_opponents.opponent'
          )
          break
        case 'next_week_opponent_total':
          this.on(
            `${rate_type_table_name}.${team_unit}`,
            'next_week_opponents.opponent'
          )
          break

        default:
          console.log(`Unknown matchup_opponent_type: ${matchup_opponent_type}`)
          break
      }
    } else {
      this.on(`${rate_type_table_name}.${team_unit}`, 'player.current_nfl_team')
    }

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
      this.on(`${rate_type_table_name}.week`, '=', 'player_years_weeks.week')
    }

    // TODO review this

    if (group_by) {
      switch (group_by) {
        case 'half':
          this.on(
            db.raw(
              `${rate_type_table_name}.half = CASE WHEN player_games.qtr <= 2 THEN 1 ELSE 2 END`
            )
          )
          break
        case 'quarter':
          this.on(`${rate_type_table_name}.qtr`, 'player_games.qtr')
          break
        case 'drive':
          this.on(`${rate_type_table_name}.drive_seq`, 'player_games.drive_seq')
          break
        case 'series':
          this.on(
            `${rate_type_table_name}.series_seq`,
            'player_games.series_seq'
          )
          break
      }
    }
  })
}
