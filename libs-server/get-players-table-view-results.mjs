import db from '#db'
import players_table_column_definitions from './players-table-column-definitions.mjs'

const get_column_index = ({ column_id, index, columns }) => {
  const columns_with_same_id = columns.filter(
    ({ column: c }) => (typeof c === 'string' ? c : c.column_id) === column_id
  )
  return columns_with_same_id.findIndex(({ index: i }) => i === index)
}

const find_sort_column = ({ column_id, column_index = 0, columns }) => {
  const item = columns.find(({ column, index }) => {
    const c_id = typeof column === 'string' ? column : column.column_id
    return (
      c_id === column_id &&
      get_column_index({ column_id: c_id, index, columns }) === column_index
    )
  })

  return item ? item.column : null
}

const get_table_name = ({ column_definition, column_params }) => {
  return column_definition.table_alias
    ? column_definition.table_alias({ params: column_params })
    : column_definition.table_name
}

const add_select_clause = ({
  players_query,
  column_definition,
  table_name,
  column_params,
  column_index = 0
}) => {
  if (column_definition.select) {
    column_definition.select({
      query: players_query,
      table_name,
      params: column_params,
      column_index
    })
  } else if (column_definition.select_as) {
    const select_as = column_definition.select_as(column_params)
    players_query.select(
      `${table_name}.${column_definition.column_name} AS ${select_as}_${column_index}`
    )
  } else {
    players_query.select(
      `${table_name}.${column_definition.column_name} as ${column_definition.column_name}_${column_index}`
    )
  }
}

const join_table_if_needed = ({
  players_query,
  table_name,
  column_definition,
  column_params,
  joined_table_index,
  join_type = 'LEFT'
}) => {
  if (!joined_table_index[table_name]) {
    if (column_definition.join) {
      column_definition.join({
        query: players_query,
        table_name,
        params: column_params,
        join_type
      })
    } else if (table_name !== 'player' && table_name !== 'nfl_plays') {
      players_query.leftJoin(table_name, `${table_name}.pid`, 'player.pid')
    }

    joined_table_index[table_name] = true
  }
}

const get_where_string = ({ where_clause, column_definition, table_name }) => {
  const column_name = column_definition.select_as
    ? column_definition.select_as(where_clause.params)
    : column_definition.column_name
  const where_column = column_definition.where_column
    ? column_definition.where_column({
        case_insensitive: where_clause.operator === 'ILIKE'
      })
    : column_definition.use_having
      ? column_name
      : `${table_name}.${column_name}`

  let where_string = ''

  if (where_clause.operator === 'IS NULL') {
    where_string = `${where_column} IS NULL`
  } else if (where_clause.operator === 'IS NOT NULL') {
    where_string = `${where_column} IS NOT NULL`
  } else if (where_clause.operator === 'IN') {
    where_string = `${where_column} IN (${where_clause.value.join(', ')})`
  } else if (where_clause.operator === 'NOT IN') {
    where_string = `${where_column} NOT IN (${where_clause.value.join(', ')})`
  } else if (where_clause.operator === 'ILIKE') {
    where_string = `${where_column} LIKE '%${(where_clause.value || '').toUpperCase()}%'`
  } else if (where_clause.operator === 'LIKE') {
    where_string = `${where_column} LIKE '%${where_clause.value}%'`
  } else if (where_clause.operator === 'NOT LIKE') {
    where_string = `${where_column} NOT LIKE '%${where_clause.value}%'`
  } else if (where_clause.value) {
    where_string = `${where_column} ${where_clause.operator} ${where_clause.value}`
  }

  return where_string
}

const add_where_clauses_for_table = ({
  players_query,
  where_clauses,
  column_definition,
  table_name,
  column_params,
  with_statement_index
}) => {
  const where_clause_strings = []
  for (const where_clause of where_clauses) {
    const where_string = get_where_string({
      where_clause,
      column_definition,
      table_name
    })
    where_clause_strings.push(where_string)
  }

  if (column_definition.with) {
    column_definition.with({
      query: players_query,
      with_table_name: table_name,
      params: column_params,
      where_clauses: where_clause_strings
    })
    with_statement_index[table_name] = true
  } else {
    players_query.whereRaw(where_clause_strings.join(' AND '))
  }
}

const add_sort_clause = ({
  players_query,
  sort_clause,
  column_definition,
  table_name,
  column_params,
  column_index = 0
}) => {
  sort_clause.desc = sort_clause.desc === true || sort_clause.desc === 'true'
  if (column_definition.select_as) {
    const select_as = column_definition.select_as(column_params)
    players_query.orderByRaw(`${select_as}_${column_index} IS NULL`)
    players_query.orderByRaw(
      `${select_as}_${column_index} ${sort_clause.desc ? 'desc' : 'asc'}`
    )
  } else {
    players_query.orderByRaw(
      `${table_name}.${column_definition.column_name}_${column_index} IS NULL`
    )
    players_query.orderByRaw(
      `${table_name}.${column_definition.column_name}_${column_index} ${
        sort_clause.desc ? 'desc' : 'asc'
      }`
    )
  }
}

const get_grouped_where_clauses = ({
  where: where_clauses,
  players_table_column_definitions
}) => {
  const grouped_where_clauses = {}

  for (const where_clause of where_clauses) {
    const { column_id, params: column_params } = where_clause
    const column_definition = players_table_column_definitions[column_id]

    if (!column_definition) {
      continue
    }
    const table_name = get_table_name({
      column_definition,
      column_params
    })

    if (!grouped_where_clauses[table_name]) {
      grouped_where_clauses[table_name] = {
        column_definition,
        column_params,
        where_clauses: []
      }
    }
    grouped_where_clauses[table_name].where_clauses.push(where_clause)
  }

  return grouped_where_clauses
}

export default async function ({
  where = [],
  columns = [],
  prefix_columns = [],
  sort = [],
  offset = 0,
  limit = 500
}) {
  const joined_table_index = {}
  const with_statement_index = {}
  const players_query = db('player').select('player.pid')
  const table_columns = []
  for (const [index, column] of [...prefix_columns, ...columns].entries()) {
    table_columns.push({
      column,
      index
    })
  }

  const grouped_where_clauses = get_grouped_where_clauses({
    where,
    players_table_column_definitions
  })

  // call joins for where/having first so they are inner joins
  for (const [
    table_name,
    { column_definition, column_params, where_clauses }
  ] of Object.entries(grouped_where_clauses)) {
    add_where_clauses_for_table({
      players_query,
      where_clauses,
      column_definition,
      table_name,
      column_params,
      with_statement_index
    })

    join_table_if_needed({
      players_query,
      table_name,
      column_definition,
      column_params,
      joined_table_index,
      join_type: 'INNER'
    })
  }

  for (const { column, index } of table_columns) {
    const column_id = typeof column === 'string' ? column : column.column_id
    const column_params = typeof column === 'string' ? {} : column.params
    const column_definition = players_table_column_definitions[column_id]

    // column_index among columns with the same column_id
    const column_index = get_column_index({
      column_id,
      index,
      columns: table_columns
    })

    if (!column_definition) {
      continue
    }

    const table_name = get_table_name({ column_definition, column_params })
    add_select_clause({
      players_query,
      column_definition,
      table_name,
      column_params,
      column_index
    })
    join_table_if_needed({
      players_query,
      table_name,
      column_definition,
      column_params,
      joined_table_index,
      join_type: 'LEFT'
    })

    if (column_definition.with && !with_statement_index[table_name]) {
      column_definition.with({
        query: players_query,
        with_table_name: table_name,
        params: column_params
      })
      with_statement_index[table_name] = true
    }
  }

  for (const sort_clause of sort) {
    const column = find_sort_column({
      column_id: sort_clause.column_id,
      column_index: sort_clause.column_index,
      columns: table_columns
    })
    const column_id = typeof column === 'string' ? column : column.column_id
    const column_params = typeof column === 'string' ? {} : column.params
    const column_definition = players_table_column_definitions[column_id]
    const table_name = get_table_name({ column_definition, column_params })

    add_sort_clause({
      players_query,
      sort_clause,
      column_definition,
      table_name,
      column_params,
      column_index: sort_clause.column_index
    })
  }

  if (offset) {
    players_query.offset(offset)
  }

  players_query.groupBy('player.pid', 'player.lname', 'player.fname')
  players_query.limit(limit)

  console.log(players_query.toString())

  return players_query
}
