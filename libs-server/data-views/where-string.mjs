// TODO update to return an object containing the where_string and values for parameterized query
export const get_where_string = ({
  where_clause,
  column_definition,
  table_name,
  column_index = 0,
  is_main_select = false,
  params = {},
  output_select_mapping = {},
  splits,
  data_view_options = {}
}) => {
  const use_select_as =
    column_definition.select_as && is_main_select && column_definition.with
  const column_name = use_select_as
    ? column_definition.select_as({ params: where_clause.params })
    : column_definition.column_name
  // When the column resolves through the output-aggregator path, the main
  // SELECT emits `<aggregate_expression> AS <column_name>_<column_index>`.
  // Postgres rejects references to SELECT aliases in HAVING, so the
  // where-clause must reference the underlying aggregate expression
  // directly. Extract it by stripping the trailing ` AS <alias>` from the
  // aggregator-emitted SQL.
  const output_emitted = is_main_select
    ? output_select_mapping[`${where_clause.column_id}_${column_index}`]
    : null
  const has_output = Boolean(output_emitted)
  const aggregator_expr = has_output
    ? output_emitted.sql.replace(/\s+AS\s+\S+\s*$/i, '')
    : null
  const where_func =
    !has_output &&
    (is_main_select
      ? column_definition.main_where
      : column_definition.with_where)
  const where_column = where_func
    ? where_func({
        table_name,
        case_insensitive: where_clause.operator === 'ILIKE',
        params,
        column_id: where_clause.column_id,
        column_index,
        splits,
        data_view_options
      })
    : has_output
      ? aggregator_expr
      : column_definition.use_having
        ? `${column_name}_${column_index}`
        : `${table_name}.${column_name}`

  if (where_func && !where_column) return ''

  let where_string = ''
  const is_where_column_array =
    column_definition.is_where_column_array &&
    column_definition.is_where_column_array({
      params,
      splits
    })

  if (where_clause.operator === 'IS NULL') {
    where_string = `${where_column} IS NULL`
  } else if (where_clause.operator === 'IS NOT NULL') {
    where_string = `${where_column} IS NOT NULL`
  } else if (where_clause.operator === 'IN') {
    if (Array.isArray(where_clause.value) && where_clause.value.length === 0) {
      return ''
    }
    if (is_where_column_array) {
      where_string = `${where_column}::text[] && ARRAY['${where_clause.value.join("', '")}']::text[]`
    } else {
      where_string = `${where_column} IN ('${where_clause.value.join("', '")}')`
    }
  } else if (where_clause.operator === 'NOT IN') {
    if (Array.isArray(where_clause.value) && where_clause.value.length === 0) {
      return ''
    }
    if (is_where_column_array) {
      where_string = `NOT (${where_column}::text[] && ARRAY['${where_clause.value.join("', '")}']::text[])`
    } else {
      where_string = `${where_column} NOT IN ('${where_clause.value.join("', '")}')`
    }
  } else if (['ILIKE', 'LIKE', 'NOT LIKE'].includes(where_clause.operator)) {
    if (is_where_column_array) {
      where_string = `${where_column}::text ${where_clause.operator} '%${where_clause.value}%'`
    } else {
      where_string = `${where_column} ${where_clause.operator} '%${where_clause.value}%'`
    }
  } else if (where_clause.value || where_clause.value === 0) {
    if (is_where_column_array) {
      where_string = `'${where_clause.value}'::text = ANY(${where_column}::text[])`
    } else {
      where_string = `${where_column} ${where_clause.operator} '${where_clause.value}'`
    }
  }

  return where_string
}

export const get_main_where_string = (params) =>
  get_where_string({ ...params, is_main_select: true })
export const get_with_where_string = (params) =>
  get_where_string({ ...params, is_main_select: false })
