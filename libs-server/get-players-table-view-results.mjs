import db from '#db'

import players_table_column_definitions from './players-table-column-definitions.mjs'

const find_column = ({ column_id, columns }) => {
  return columns.find((column) =>
    typeof column === 'string'
      ? column === column_id
      : column.column_id === column_id
  )
}

export default async function ({
  where = [],
  columns = [],
  sort = [],
  offset = 0,
  limit = 500
}) {
  const joined_table_index = {}
  const players_query = db('player').select('player.pid')

  for (const column of columns) {
    // column could be a string representing column_id or an object containing column_id and params
    const column_id = typeof column === 'string' ? column : column.column_id
    const column_params = typeof column === 'string' ? {} : column.params
    const column_definition = players_table_column_definitions[column_id]

    if (!column_definition) {
      throw new Error(`Invalid column id: ${column_id}`)
    }

    if (column_definition.select_as) {
      const select_as = column_definition.select_as(column_params)
      players_query.select(
        `${column_definition.table_name}.${column_definition.column_name} AS ${select_as}`
      )
    } else {
      players_query.select(
        `${column_definition.table_name}.${column_definition.column_name}`
      )
    }

    if (column_definition.join) {
      column_definition.join({ query: players_query, params: column_params })
    } else if (
      column_definition.table_name !== 'player' &&
      !joined_table_index[column_definition.table_name]
    ) {
      players_query.leftJoin(
        column_definition.table_name,
        `${column_definition.table_name}.pid`,
        'player.pid'
      )
      joined_table_index[column_definition.table_name] = true
    }
  }

  for (const where_clause of where) {
    if (where_clause.operator === 'IS NULL') {
      players_query.whereNull(
        `${where_clause.table_name}.${where_clause.column_name}`
      )
    } else if (where_clause.operator === 'IS NOT NULL') {
      players_query.whereNotNull(
        `${where_clause.table_name}.${where_clause.column_name}`
      )
    } else if (where_clause.operator === 'IN') {
      players_query.whereIn(
        `${where_clause.table_name}.${where_clause.column_name}`,
        where_clause.value
      )
    } else if (where_clause.operator === 'NOT IN') {
      players_query.whereNotIn(
        `${where_clause.table_name}.${where_clause.column_name}`,
        where_clause.value
      )
    } else if (where_clause.operator === 'LIKE') {
      players_query.where(
        `${where_clause.table_name}.${where_clause.column_name}`,
        'LIKE',
        `%${where_clause.value}%`
      )
    } else if (where_clause.operator === 'NOT LIKE') {
      players_query.where(
        `${where_clause.table_name}.${where_clause.column_name}`,
        'NOT LIKE',
        `%${where_clause.value}%`
      )
    } else if (where_clause.value) {
      players_query.where(
        `${where_clause.table_name}.${where_clause.column_name}`,
        where_clause.operator,
        where_clause.value
      )
    }
  }

  for (const sort_clause of sort) {
    const column = find_column({ column_id: sort_clause.id, columns })
    const column_id = typeof column === 'string' ? column : column.column_id
    const column_params = typeof column === 'string' ? {} : column.params
    const column_definition = players_table_column_definitions[column_id]

    sort_clause.desc = sort_clause.desc === 'true'
    // postgres
    // players_query.orderByRaw(
    //   `${sort_clause.id} ${sort_clause.desc ? 'desc' : 'asc'} NULLS LAST`
    // )

    // mysql
    // use minus sign and reverse sort order to sort nulls last
    if (column_definition.select_as) {
      const select_as = column_definition.select_as(column_params)
      players_query.orderByRaw(
        `-${select_as} ${sort_clause.desc ? 'asc' : 'desc'}`
      )
    } else {
      players_query.orderByRaw(
        `-${column_definition.table_name}.${column_definition.column_name} ${
          sort_clause.desc ? 'asc' : 'desc'
        }`
      )
    }
  }

  if (offset) {
    players_query.offset(offset)
  }

  players_query.limit(limit)

  return players_query
}
