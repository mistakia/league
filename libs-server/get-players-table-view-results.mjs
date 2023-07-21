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
  prefix_columns = [],
  sort = [],
  offset = 0,
  limit = 500
}) {
  const joined_table_index = {}
  const nfl_plays_join_index = {}
  const players_query = db('player').select('player.pid')

  const all_table_columns = [...prefix_columns, ...columns]

  for (const column of all_table_columns) {
    // column could be a string representing column_id or an object containing column_id and params
    const column_id = typeof column === 'string' ? column : column.column_id
    const column_params = typeof column === 'string' ? {} : column.params
    const column_definition = players_table_column_definitions[column_id]

    if (!column_definition) {
      continue
    }

    const table_name = column_definition.table_alias
      ? column_definition.table_alias(column_params)
      : column_definition.table_name

    if (column_definition.select) {
      column_definition.select({ query: players_query, params: column_params })
    } else if (column_definition.select_as) {
      const select_as = column_definition.select_as(column_params)
      players_query.select(
        `${table_name}.${column_definition.column_name} AS ${select_as}`
      )
    } else {
      players_query.select(`${table_name}.${column_definition.column_name}`)
    }

    if (!joined_table_index[table_name]) {
      if (column_definition.join) {
        column_definition.join({ query: players_query, params: column_params })
      } else if (table_name !== 'player' && table_name !== 'nfl_plays') {
        players_query.leftJoin(table_name, `${table_name}.pid`, 'player.pid')
      }

      joined_table_index[table_name] = true
    }

    if (column_definition.nfl_plays_join_on) {
      nfl_plays_join_index[column_definition.nfl_plays_join_on] = true
    }
  }

  const nfl_plays_join_keys = Object.keys(nfl_plays_join_index)
  const nfl_play_joins = []
  for (const nfl_plays_join_key of nfl_plays_join_keys) {
    nfl_play_joins.push('player.pid = nfl_plays.' + nfl_plays_join_key)
  }

  if (nfl_plays_join_keys.length) {
    players_query.joinRaw(`join nfl_plays ON (${nfl_play_joins.join(' OR ')})`)
    players_query.where('nfl_plays.play_type', '!=', 'NOPL')
  }

  for (const where_clause of where) {
    const { column_id, params: column_params } = where_clause
    const column_definition = players_table_column_definitions[column_id]

    if (!column_definition) {
      continue
    }

    if (column_definition.use_having) {
      continue
    }

    const table_name = column_definition.table_alias
      ? column_definition.table_alias(column_params)
      : column_definition.table_name

    const column_name = column_definition.select_as
      ? column_definition.select_as(column_params)
      : column_definition.column_name

    if (!joined_table_index[table_name]) {
      if (column_definition.join) {
        column_definition.join({ query: players_query, params: column_params })
      } else if (table_name !== 'player' && table_name !== 'nfl_plays') {
        players_query.leftJoin(table_name, `${table_name}.pid`, 'player.pid')
      }

      joined_table_index[table_name] = true
    }

    const where_column = column_definition.where_column
      ? column_definition.where_column({
          case_insensitive: where_clause.operator === 'ILIKE'
        })
      : `${table_name}.${column_name}`

    if (where_clause.operator === 'IS NULL') {
      players_query.whereNull(where_column)
    } else if (where_clause.operator === 'IS NOT NULL') {
      players_query.whereNotNull(where_column)
    } else if (where_clause.operator === 'IN') {
      players_query.whereIn(where_column, where_clause.value)
    } else if (where_clause.operator === 'NOT IN') {
      players_query.whereNotIn(where_column, where_clause.value)
    } else if (where_clause.operator === 'ILIKE') {
      players_query.where(
        where_column,
        'LIKE',
        `%${(where_clause.value || '').toUpperCase()}%`
      )
    } else if (where_clause.operator === 'LIKE') {
      players_query.where(where_column, 'LIKE', `%${where_clause.value}%`)
    } else if (where_clause.operator === 'NOT LIKE') {
      players_query.where(where_column, 'NOT LIKE', `%${where_clause.value}%`)
    } else if (where_clause.value) {
      players_query.where(
        where_column,
        where_clause.operator,
        where_clause.value
      )
    }
  }

  for (const sort_clause of sort) {
    const column = find_column({
      column_id: sort_clause.id,
      columns: all_table_columns
    })
    const column_id = typeof column === 'string' ? column : column.column_id
    const column_params = typeof column === 'string' ? {} : column.params
    const column_definition = players_table_column_definitions[column_id]
    const table_name = column_definition.table_alias
      ? column_definition.table_alias(column_params)
      : column_definition.table_name

    sort_clause.desc = sort_clause.desc === true || sort_clause.desc === 'true'
    // mysql
    // use minus sign and reverse sort order to sort nulls last
    if (column_definition.select_as) {
      const select_as = column_definition.select_as(column_params)
      players_query.orderByRaw(`${select_as} IS NULL`)
      players_query.orderByRaw(
        `${select_as} ${sort_clause.desc ? 'desc' : 'asc'}`
      )
    } else {
      players_query.orderByRaw(
        `${table_name}.${column_definition.column_name} IS NULL`
      )
      players_query.orderByRaw(
        `${table_name}.${column_definition.column_name} ${
          sort_clause.desc ? 'desc' : 'asc'
        }`
      )
    }

    // postgres
    // use NULLS LAST
  }

  if (offset) {
    players_query.offset(offset)
  }

  players_query.groupBy('player.pid', 'player.lname', 'player.fname')

  players_query.limit(limit)

  console.log(players_query.toString())

  return players_query
}
