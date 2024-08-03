const get_rate_type_sql = ({ table_name, column_name, rate_type_table_name }) =>
  `CAST(${table_name}.${column_name} AS DECIMAL) / NULLIF(CAST(${rate_type_table_name}.rate_type_total_count AS DECIMAL), 0)`

const get_select_string = ({
  column_id,
  column_params,
  column_index,
  column_definition,
  table_name,
  rate_type_column_mapping,
  splits,
  is_main_select = false
}) => {
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
  const select_as = column_definition.select_as
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
    if (column_definition.has_numerator_denominator) {
      final_select_expression = `SUM(${join_table_name}.${select_as}_numerator) / NULLIF(SUM(${join_table_name}.${select_as}_denominator), 0)`
    } else {
      final_select_expression = `SUM(${column_value})`
    }

    if (rate_type_table_name) {
      const min_year_offset = Math.min(...column_params.year_offset)
      const max_year_offset = Math.max(...column_params.year_offset)

      // TODO not working correctly
      final_select_expression = `${final_select_expression} / NULLIF(CAST(SUM(CASE WHEN ${rate_type_table_name}.year BETWEEN ${table_name}.year + ${min_year_offset} AND ${table_name}.year + ${max_year_offset} THEN ${rate_type_table_name}.rate_type_total_count ELSE 0 END) AS DECIMAL), 0)`
    }
  } else {
    final_select_expression = select_expression
  }

  return {
    select: [`${final_select_expression} AS "${select_as}_${column_index}"`],
    group_by:
      has_year_offset_range || !is_main_select
        ? []
        : [
            column_value,
            rate_type_table_name
              ? `${rate_type_table_name}.rate_type_total_count`
              : null
          ].filter(Boolean)
  }
}

export const get_with_select_string = (params) => get_select_string(params)

export const get_main_select_string = (params) =>
  get_select_string({ ...params, is_main_select: true })
