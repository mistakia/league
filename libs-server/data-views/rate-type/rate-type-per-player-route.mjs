import db from '#db'
import {
  resolve_year_offset_range,
  emit_year_match
} from '#libs-server/data-views/param-utils.mjs'
import { emit_rate_outer_select } from './emit-rate-outer-select.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import { apply_scope_to_query } from '#libs-server/data-views/apply-scope-to-query.mjs'
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

export const get_per_player_route_cte_table_name = ({
  params = {},
  group_by = null
} = {}) => {
  const { nfl_week } = get_default_params({ params })

  const group_by_suffix = group_by ? `_${group_by}` : ''

  const play_level_params_suffix = get_play_level_params_hash_suffix({ params })

  return get_table_hash(
    `per_player_route_pass_breakup${group_by_suffix}${play_level_params_suffix}_nfl_week_${nfl_week.join('_')}`
  )
}

export const add_per_player_route_cte = ({
  players_query,
  params,
  rate_type_table_name,
  row_axes,
  group_by = null,
  data_view_options = {},
  query_context = null
}) => {
  const cte_query = db('nfl_plays_receiver')
    .select('nfl_plays_receiver.gsis_id')
    .join('nfl_plays', function () {
      this.on('nfl_plays_receiver.esbid', '=', 'nfl_plays.esbid').andOn(
        'nfl_plays_receiver.playId',
        '=',
        'nfl_plays.playId'
      )
    })
    .where('play_type', 'PASS')
    .groupBy('nfl_plays_receiver.gsis_id')

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

  for (const row_axis of row_axes) {
    if (row_axis === 'year') {
      cte_query.select('nfl_plays.year')
      cte_query.groupBy('nfl_plays.year')
    } else if (row_axis === 'week') {
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
    params: denominator_params,
    query_context
  })

  // nfl_plays_receiver carries year but not seas_type / nfl_week_id; mirror
  // the view-scope year predicate onto it explicitly.
  if (
    query_context &&
    query_context.nfl_week_ids &&
    query_context.nfl_week_ids.length
  ) {
    apply_scope_to_query({
      query: cte_query,
      table_name: 'nfl_plays_receiver',
      query_context,
      column_params: params,
      has_seas_type: false,
      has_nfl_week_id: false
    })
  }

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would mask the partition-pruning
  // behavior we rely on.
  players_query.withMaterialized(rate_type_table_name, cte_query)
}

export const join_per_player_route_cte = ({
  players_query,
  params,
  rate_type_table_name,
  row_axes,
  data_view_options = {}
}) => {
  players_query.leftJoin(rate_type_table_name, function () {
    this.on(`${rate_type_table_name}.gsis_id`, 'player.gsisid')

    if (row_axes.includes('year')) {
      const offset_range = resolve_year_offset_range(params)
      if (offset_range) {
        // Correlate the rate-type table year to the base-year anchor THROUGH
        // the offset via the shared primitive (single `= ref+k`, range
        // BETWEEN) -- replaces the inline has_year_offset_range /
        // has_single_year_offset reimplementation.
        emit_year_match({
          builder: this,
          db,
          year_reference: data_view_options.year_reference,
          source: {},
          key_columns: { year: 'year' },
          params,
          ref: rate_type_table_name
        })
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

    if (row_axes.includes('week')) {
      this.on(
        `${rate_type_table_name}.week`,
        '=',
        data_view_options.week_reference
      )
    }

    // No group_by correlation here by design: a group_by period
    // (half/quarter/drive/series) is encapsulated in the denominator's
    // COUNT(DISTINCT CONCAT(esbid, <dim>)) expression in add_per_player_route_cte,
    // which keeps the CTE at gsis_id grain. There is no per-dimension column to
    // join against, and correlating one would fan the denominator out.
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
  return get_per_player_route_cte_table_name({
    params,
    group_by: dispatch_params.group_by ?? null
  })
}

export const add_cte = ({
  query_context,
  params,
  cte_name,
  dispatch_params = {}
}) => {
  if (query_context.applied_output_ctes.has(cte_name)) return
  add_per_player_route_cte({
    players_query: query_context.players_query,
    params,
    rate_type_table_name: cte_name,
    row_axes: query_context.row_axes,
    group_by: dispatch_params.group_by ?? null,
    query_context
  })
  query_context.applied_output_ctes.add(cte_name)
}

export const join_cte = ({ query_context, cte_name, params }) => {
  // dispatch_params (group_by) intentionally not threaded into the join:
  // group_by affects only the CTE body (the COUNT(DISTINCT) denominator), never
  // the join correlation, which is gsis_id (+ year/week split). See
  // join_per_player_route_cte.
  join_per_player_route_cte({
    players_query: query_context.players_query,
    params: params ?? query_context.params,
    rate_type_table_name: cte_name,
    row_axes: query_context.row_axes,
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
