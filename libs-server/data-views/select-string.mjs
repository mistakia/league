import { resolve_team_join_target } from './resolve-team-join-target.mjs'

export const get_rate_type_sql = ({
  table_name,
  column_name,
  rate_type_table_name
}) =>
  `CAST(${table_name}.${column_name} AS DECIMAL) / NULLIF(CAST(${rate_type_table_name}.rate_type_total_count AS DECIMAL), 0)`

const get_select_string = ({
  column_id,
  column_params,
  column_index,
  column_definition,
  table_name,
  rate_type_column_mapping,
  output_select_mapping = {},
  splits,
  is_main_select = false,
  data_view_options = {},
  query_context = null
}) => {
  // Output-aggregator dispatch (Phase C step 1): when a retrofitted column
  // is invoked with `params.output`, the dispatcher pre-resolved the outer
  // SELECT via the aggregator plugin. Return its raw SQL here so the main
  // SELECT uses the aggregator-emitted expression instead of the legacy
  // main_select / column-value path. Only fires for is_main_select; WITH
  // selects never reference the aggregator CTE.
  if (is_main_select) {
    const output_select = output_select_mapping[`${column_id}_${column_index}`]
    if (output_select && output_select.sql) {
      return {
        select: [output_select],
        group_by: []
      }
    }
  }

  const rate_type_table_name =
    rate_type_column_mapping[`${column_id}_${column_index}`]
  const join_table_name =
    is_main_select && column_definition.join_table_name
      ? column_definition.join_table_name({
          table_name,
          params: column_params,
          column_index,
          rate_type_table_name,
          splits
        })
      : !is_main_select && column_definition.table_name
        ? column_definition.table_name
        : table_name
  const column_value = `"${join_table_name}"."${column_definition.column_name}"`

  const get_select_expression = () => {
    if (rate_type_table_name) {
      return get_rate_type_sql({
        table_name: join_table_name,
        column_name: column_definition.column_name,
        rate_type_table_name
      })
    }
    return column_value
  }

  const select_func = is_main_select
    ? column_definition.main_select
    : column_definition.with_select
  if (select_func) {
    return {
      select: select_func({
        table_name,
        params: column_params,
        column_index,
        rate_type_table_name,
        splits
      }),
      group_by:
        is_main_select && column_definition.main_group_by
          ? column_definition.main_group_by({
              table_name,
              params: column_params,
              column_index,
              rate_type_table_name,
              splits
            })
          : []
    }
  }

  const select_expression = get_select_expression()
  const select_as =
    is_main_select && column_definition.select_as
      ? column_definition.select_as({ params: column_params })
      : column_definition.column_name

  const has_year_offset_range =
    is_main_select &&
    column_params.year_offset &&
    Array.isArray(column_params.year_offset) &&
    column_params.year_offset.length > 1 &&
    column_params.year_offset[0] !== column_params.year_offset[1]

  let final_select_expression
  if (is_main_select && has_year_offset_range) {
    const min_year_offset = Math.min(...column_params.year_offset)
    const max_year_offset = Math.max(...column_params.year_offset)

    // Use centralized references
    const year_clause = data_view_options.year_reference
    // Team-grained sources have nfl_team, not pid; the correlated subquery
    // must use the same projection target that apply_team_stats_join would
    // use in the non-offset-range JOIN path (matchup opponent, per-season
    // team, or current_nfl_team).
    const is_team_grain =
      typeof column_definition.source?.grain === 'string' &&
      column_definition.source.grain.startsWith('team')
    const correlation_key = is_team_grain ? 'nfl_team' : 'pid'
    const correlation_ref = is_team_grain
      ? resolve_team_join_target({
          query_context: query_context || { data_view_options },
          params: column_params
        })
      : data_view_options.pid_reference

    if (column_definition.has_numerator_denominator) {
      final_select_expression = `(SELECT SUM(${join_table_name}.${select_as}_numerator) / NULLIF(SUM(${join_table_name}.${select_as}_denominator), 0) FROM ${join_table_name} WHERE ${join_table_name}.${correlation_key} = ${correlation_ref} AND ${join_table_name}.year BETWEEN ${year_clause} + ${min_year_offset} AND ${year_clause} + ${max_year_offset})`
    } else if (column_definition.main_select_string_year_offset_range) {
      final_select_expression =
        column_definition.main_select_string_year_offset_range({
          table_name: join_table_name,
          params: column_params,
          data_view_options
        })
    } else {
      final_select_expression = `(SELECT SUM(${join_table_name}.${column_definition.column_name}) FROM ${join_table_name} WHERE ${join_table_name}.${correlation_key} = ${correlation_ref} AND ${join_table_name}.year BETWEEN ${year_clause} + ${min_year_offset} AND ${year_clause} + ${max_year_offset})`
    }

    if (rate_type_table_name) {
      final_select_expression = `${final_select_expression} / NULLIF((SELECT CAST(SUM(${rate_type_table_name}.rate_type_total_count) AS DECIMAL) FROM ${rate_type_table_name} WHERE ${rate_type_table_name}.${correlation_key} = ${correlation_ref} AND ${rate_type_table_name}.year BETWEEN ${year_clause} + ${min_year_offset} AND ${year_clause} + ${max_year_offset}), 0)`
    }
  } else {
    final_select_expression = select_expression
  }

  const group_by =
    !is_main_select || has_year_offset_range
      ? []
      : [
          column_value,
          rate_type_table_name
            ? `${rate_type_table_name}.rate_type_total_count`
            : null
        ]

  // TODO unused currently
  // if (is_main_select && column_definition.main_group_by) {
  //   group_by.push(...column_definition.main_group_by({ table_name, params: column_params, column_index, rate_type_table_name, splits }))
  // }

  const select_alias = is_main_select
    ? `${select_as}_${column_index}`
    : select_as

  return {
    select: [`${final_select_expression} AS "${select_alias}"`],
    group_by: group_by.filter(Boolean)
  }
}

export const get_with_select_string = (params) => get_select_string(params)

export const get_main_select_string = (params) =>
  get_select_string({ ...params, is_main_select: true })
