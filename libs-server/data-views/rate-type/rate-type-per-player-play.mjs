import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_rate_type_denominator_params, {
  get_play_level_params_hash_suffix
} from '#libs-shared/get-rate-type-denominator-params.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'
export const get_default_params = ({ params = {} } = {}) => {
  const nfl_week = resolve_nfl_week_id_from_year_param(params)

  return {
    nfl_week
  }
}

export const get_per_player_play_cte_table_name = ({
  params = {},
  play_type = null,
  group_by = null
} = {}) => {
  const { nfl_week } = get_default_params({ params })

  const play_type_suffix = play_type ? `_${play_type.toLowerCase()}` : ''
  const group_by_suffix = group_by ? `_${group_by}` : ''

  const play_level_params_suffix = get_play_level_params_hash_suffix({ params })

  return get_table_hash(
    `per_player_play${play_type_suffix}${group_by_suffix}${play_level_params_suffix}_nfl_week_${nfl_week.join('_')}`
  )
}

export const add_per_player_play_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits,
  play_type = null,
  group_by = null,
  data_view_options = {}
}) => {
  const cte_query = db('nfl_plays')
    .select('nfl_snaps.gsis_it_id')
    .join('nfl_snaps', function () {
      this.on('nfl_plays.esbid', '=', 'nfl_snaps.esbid').andOn(
        'nfl_plays.playId',
        '=',
        'nfl_snaps.playId'
      )
    })
    .whereNot('play_type', 'NOPL')
    .groupBy('nfl_snaps.gsis_it_id')

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

  const denominator_params = get_rate_type_denominator_params({ params })
  delete denominator_params.career_year
  delete denominator_params.career_game
  delete denominator_params.year_offset

  apply_play_by_play_column_params_to_query({
    query: cte_query,
    params: denominator_params
  })

  players_query.with(rate_type_table_name, cte_query)
}

export const join_per_player_play_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits,
  group_by = null,
  data_view_options = {}
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
    this.on(`${rate_type_table_name}.gsis_it_id`, 'player.gsis_it_id')

    if (splits.includes('year')) {
      if (has_year_offset_range) {
        const min_offset = Math.min(...year_offset)
        const max_offset = Math.max(...year_offset)
        this.on(
          db.raw(
            `${rate_type_table_name}.year BETWEEN ${data_view_options.year_reference} + ? AND ${data_view_options.year_reference} + ?`,
            [min_offset, max_offset]
          )
        )
      } else if (has_single_year_offset) {
        const offset = Array.isArray(year_offset) ? year_offset[0] : year_offset
        this.on(
          db.raw(
            `${rate_type_table_name}.year = ${data_view_options.year_reference} + ?`,
            [offset]
          )
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
          this.on(
            `${rate_type_table_name}.year`,
            data_view_options.year_reference
          )
        }
      }
    }

    if (splits.includes('week')) {
      this.on(
        `${rate_type_table_name}.week`,
        '=',
        data_view_options.week_reference
      )
    }

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
