import db from '#db'
import { emit_rate_outer_select } from './emit-rate-outer-select.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_output_denominator_params, {
  get_play_level_params_hash_suffix
} from '#libs-shared/get-output-denominator-params.mjs'
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'
import {
  resolve_year_offset_range,
  emit_year_match
} from '#libs-server/data-views/param-utils.mjs'

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
  row_axes,
  stat_type,
  rate_type_params = {},
  data_view_options = {},
  query_context = null
}) => {
  const cte_query = db('nfl_plays').whereNot('play_type', 'NOPL')

  let count_expression = 'COUNT(*)'
  switch (stat_type) {
    case 'rush_attempt':
      count_expression = `SUM(CASE WHEN ball_carrier_pid IS NOT NULL THEN 1 ELSE 0 END)`
      cte_query.select('nfl_plays.ball_carrier_pid as pid')
      cte_query.groupBy('nfl_plays.ball_carrier_pid')
      break
    case 'pass_attempt':
      count_expression = `SUM(CASE WHEN passer_pid IS NOT NULL AND (is_sack IS NULL OR is_sack = false) THEN 1 ELSE 0 END)`
      cte_query.select('nfl_plays.passer_pid as pid')
      cte_query.groupBy('nfl_plays.passer_pid')
      break
    case 'target':
      count_expression = `SUM(CASE WHEN target_pid IS NOT NULL THEN 1 ELSE 0 END)`
      cte_query.select('nfl_plays.target_pid as pid')
      cte_query.groupBy('nfl_plays.target_pid')
      break
    case 'reception':
      count_expression = `SUM(CASE WHEN target_pid IS NOT NULL AND is_completion = true THEN 1 ELSE 0 END)`
      cte_query.select('nfl_plays.target_pid as pid')
      cte_query.groupBy('nfl_plays.target_pid')
      break
    case 'touch':
      cte_query.crossJoin(
        db.raw(
          'LATERAL (VALUES (nfl_plays.ball_carrier_pid), (CASE WHEN nfl_plays.is_completion = true THEN nfl_plays.target_pid END)) AS t(pid)'
        )
      )
      cte_query.whereRaw('t.pid IS NOT NULL')
      cte_query.select('t.pid as pid')
      cte_query.groupBy('t.pid')
      break
    case 'opportunity':
      cte_query.crossJoin(
        db.raw(
          'LATERAL (VALUES (CASE WHEN nfl_plays.is_sack IS NULL OR nfl_plays.is_sack = false THEN nfl_plays.passer_pid END), (nfl_plays.ball_carrier_pid), (nfl_plays.target_pid)) AS t(pid)'
        )
      )
      cte_query.whereRaw('t.pid IS NOT NULL')
      cte_query.select('t.pid as pid')
      cte_query.groupBy('t.pid')
      break
  }

  cte_query.select(db.raw(`${count_expression} as rate_type_total_count`))

  for (const row_axis of row_axes) {
    if (row_axis === 'year') {
      // Grain axis stays 'year' in the row-axis vocabulary; alias the
      // renamed physical column back so this CTE's own output ('year',
      // referenced downstream as `${rate_type_table_name}.year`) is unchanged.
      cte_query.select('nfl_plays.season_year as year')
      cte_query.groupBy('nfl_plays.season_year')
    } else if (row_axis === 'week') {
      cte_query.select('nfl_plays.week')
      cte_query.groupBy('nfl_plays.week')
    }
  }

  const denominator_params = get_output_denominator_params({ params })
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
  row_axes,
  data_view_options = {}
}) => {
  players_query.leftJoin(rate_type_table_name, function () {
    // Use centralized player PID reference
    this.on(`${rate_type_table_name}.pid`, data_view_options.pid_reference)

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
  })
}

// ---- output-aggregator plugin interface (identity-driven) -----------------

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
    row_axes: query_context.row_axes,
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
    row_axes: query_context.row_axes,
    data_view_options: query_context.data_view_options
  })
}

export const emit_outer_select = emit_rate_outer_select

export default {
  get_cte_name,
  add_cte,
  join_cte,
  emit_outer_select
}
