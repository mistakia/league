// TODO update to return an object containing the where_string and values for parameterized query
const get_where_string = ({
  where_clause,
  column_definition,
  table_name,
  column_index = 0,
  is_main_select = false,
  params = {},
  rate_type_column_mapping
}) => {
  const column_name = column_definition.select_as
    ? column_definition.select_as({ params: where_clause.params })
    : column_definition.column_name
  const where_func = is_main_select
    ? column_definition.main_where
    : column_definition.with_where
  const where_column = where_func
    ? where_func({
        table_name,
        case_insensitive: where_clause.operator === 'ILIKE',
        params,
        rate_type_column_mapping,
        column_id: where_clause.column_id,
        column_index
      })
    : column_definition.use_having
      ? `${column_name}_${column_index}`
      : `${table_name}.${column_name}`

  if (where_func && !where_column) return ''

  let where_string = ''

  if (where_clause.operator === 'IS NULL') {
    where_string = `${where_column} IS NULL`
  } else if (where_clause.operator === 'IS NOT NULL') {
    where_string = `${where_column} IS NOT NULL`
  } else if (where_clause.operator === 'IN') {
    where_string = `${where_column} IN ('${where_clause.value.join("', '")}')`
  } else if (where_clause.operator === 'NOT IN') {
    where_string = `${where_column} NOT IN ('${where_clause.value.join("', '")}')`
  } else if (where_clause.operator === 'ILIKE') {
    where_string = `${where_column} ILIKE '%${where_clause.value}%'`
  } else if (where_clause.operator === 'LIKE') {
    where_string = `${where_column} LIKE '%${where_clause.value}%'`
  } else if (where_clause.operator === 'NOT LIKE') {
    where_string = `${where_column} NOT LIKE '%${where_clause.value}%'`
  } else if (where_clause.value || where_clause.value === 0) {
    where_string = `${where_column} ${where_clause.operator} '${where_clause.value}'`
  }

  return where_string
}

export const get_main_where_string = (params) =>
  get_where_string({ ...params, is_main_select: true })
export const get_with_where_string = (params) =>
  get_where_string({ ...params, is_main_select: false })
