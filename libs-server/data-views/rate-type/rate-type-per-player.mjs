import db from '#db'
import { emit_rate_outer_select } from './emit-rate-outer-select.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_rate_type_denominator_params, {
  get_play_level_params_hash_suffix
} from '#libs-shared/get-rate-type-denominator-params.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'

export const get_per_player_cte_table_name = ({
  params = {},
  stat_type = null,
  rate_type_params = {}
} = {}) => {
  const nfl_week = resolve_nfl_week_id_from_year_param(params)

  const stat_type_suffix = stat_type ? `_${stat_type}` : ''
  const column_params_suffix = Object.entries(rate_type_params)
    .map(([key, value]) => `_${key}_${value}`)
    .join('')

  const play_level_params_suffix = get_play_level_params_hash_suffix({
    params,
    rate_type_params
  })

  return get_table_hash(
    `per_player${stat_type_suffix}${column_params_suffix}${play_level_params_suffix}_nfl_week_${nfl_week.join('_')}`
  )
}

export const add_per_player_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits,
  stat_type,
  rate_type_params = {},
  data_view_options = {},
  query_context = null
}) => {
  const cte_query = db('nfl_plays').whereNot('play_type', 'NOPL')

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
    case 'reception':
      count_expression = `SUM(CASE WHEN trg_pid IS NOT NULL AND comp = true THEN 1 ELSE 0 END)`
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

  const denominator_params = get_rate_type_denominator_params({ params })
  delete denominator_params.year_offset
  const filtered_params = {
    ...denominator_params,
    ...rate_type_params
  }

  apply_play_by_play_column_params_to_query({
    query: cte_query,
    params: filtered_params,
    query_context
  })

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would mask the partition-pruning
  // behavior we rely on.
  players_query.withMaterialized(rate_type_table_name, cte_query)
}

export const join_per_player_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits,
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
    // Use centralized player PID reference
    this.on(`${rate_type_table_name}.pid`, data_view_options.pid_reference)

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
  })
}

// ---- output-aggregator plugin interface (identity-driven) -----------------

export const consumes_params = [
  'year',
  'nfl_week_id',
  'seas_type',
  'year_offset',
  'output_column_params',
  'rate_type_column_params'
]

export const get_cte_name = ({ params, dispatch_params = {} }) => {
  return get_per_player_cte_table_name({
    params,
    stat_type: dispatch_params.stat_type ?? null,
    rate_type_params: dispatch_params.rate_type_params ?? {}
  })
}

export const add_cte = ({
  query_context,
  params,
  cte_name,
  dispatch_params = {}
}) => {
  if (query_context.applied_output_ctes.has(cte_name)) return
  add_per_player_cte({
    players_query: query_context.players_query,
    params,
    rate_type_table_name: cte_name,
    splits: query_context.splits,
    stat_type: dispatch_params.stat_type ?? null,
    rate_type_params: dispatch_params.rate_type_params ?? {},
    query_context
  })
  query_context.applied_output_ctes.add(cte_name)
}

export const join_cte = ({ query_context, cte_name, params }) => {
  join_per_player_cte({
    players_query: query_context.players_query,
    params: params ?? query_context.params,
    rate_type_table_name: cte_name,
    splits: query_context.splits,
    data_view_options: query_context.data_view_options
  })
}

export const emit_outer_select = emit_rate_outer_select

export default {
  consumes_params,
  get_cte_name,
  add_cte,
  join_cte,
  emit_outer_select
}
