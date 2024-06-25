import db from '#db'
import players_table_column_definitions from './players-table-column-definitions.mjs'
import apply_play_by_play_column_params_to_query from './apply-play-by-play-column-params-to-query.mjs'

const add_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  pid_column
}) => {
  if (!with_table_name) {
    throw new Error('with_table_name is required')
  }

  const with_query = db('nfl_plays')
    .select(pid_column)
    .whereNot('play_type', 'NOPL')
    .where('seas_type', 'REG')
    .groupBy(pid_column)

  const unique_select_strings = new Set(select_strings)

  for (const select_string of unique_select_strings) {
    with_query.select(db.raw(select_string))
  }

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params
  })

  // where_clauses to filter stats/metrics
  for (const having_clause of having_clauses) {
    with_query.havingRaw(having_clause)
  }

  query.with(with_table_name, with_query)
}

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

const get_where_string = ({
  where_clause,
  column_definition,
  table_name,
  column_index = 0
}) => {
  const column_name = column_definition.select_as
    ? column_definition.select_as(where_clause.params)
    : column_definition.column_name
  const where_column = column_definition.where_column
    ? column_definition.where_column({
        case_insensitive: where_clause.operator === 'ILIKE'
      })
    : column_definition.use_having
      ? `${column_name}_${column_index}`
      : `${table_name}.${column_name}`

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
    where_string = `${where_column} LIKE '%${(where_clause.value || '').toUpperCase()}%'`
  } else if (where_clause.operator === 'LIKE') {
    where_string = `${where_column} LIKE '%${where_clause.value}%'`
  } else if (where_clause.operator === 'NOT LIKE') {
    where_string = `${where_column} NOT LIKE '%${where_clause.value}%'`
  } else if (where_clause.value) {
    where_string = `${where_column} ${where_clause.operator} '${where_clause.value}'`
  }

  return where_string
}

const get_select_string = ({
  column_params,
  column_index,
  column_definition,
  table_name
}) => {
  if (column_definition.select) {
    return column_definition.select({
      table_name,
      params: column_params,
      column_index
    })
  } else if (column_definition.select_as) {
    const select_as = column_definition.select_as(column_params)
    return [
      `\`${table_name}\`.\`${column_definition.column_name}\` AS \`${select_as}_${column_index}\``
    ]
  } else {
    return [
      `\`${table_name}\`.\`${column_definition.column_name}\` as \`${column_definition.column_name}_${column_index}\``
    ]
  }
}

const add_sort_clause = ({
  table_name,
  players_query,
  sort_clause,
  column_definition,
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
  } else if (column_index) {
    // TODO temp fix to not break the query when there are multiple of the same column_ids
    players_query.orderByRaw(
      `\`${column_definition.column_name}_${column_index}\` IS NULL`
    )
    players_query.orderByRaw(
      `\`${column_definition.column_name}_${column_index}\` ${
        sort_clause.desc ? 'desc' : 'asc'
      }`
    )
  } else if (column_definition.use_play_by_play_with) {
    // TODO temp fix to not break the query when there are multiple 0 index columns across different with tables
    players_query.orderByRaw(
      `\`${table_name}\`.\`${column_definition.column_name}_0\` IS NULL`
    )
    players_query.orderByRaw(
      `\`${table_name}\`.\`${column_definition.column_name}_0\` ${
        sort_clause.desc ? 'desc' : 'asc'
      }`
    )
  } else {
    players_query.orderByRaw(`\`${column_definition.column_name}_0\` IS NULL`)
    players_query.orderByRaw(
      `\`${column_definition.column_name}_0\` ${
        sort_clause.desc ? 'desc' : 'asc'
      }`
    )
  }
}

const add_clauses_for_table = ({
  players_query,
  select_columns = [],
  where_clauses = [],
  table_name,
  column_params = {}
}) => {
  const column_ids = []
  const select_strings = []
  let use_play_by_play_with = false

  // the pid column and join_func should be the same among column definitions with the same table name/alias
  let pid_column = null
  let join_func = null
  let with_func = null

  for (const { column_id, column_index } of select_columns) {
    const column_definition = players_table_column_definitions[column_id]
    const select_string = get_select_string({
      column_params,
      column_index,
      column_definition,
      table_name
    })
    for (const s of select_string) {
      select_strings.push(s)
    }

    if (column_definition.join) {
      join_func = column_definition.join
    }

    if (column_definition.use_play_by_play_with) {
      use_play_by_play_with = true
      pid_column = column_definition.pid_column
      join_func = column_definition.join
    } else if (column_definition.with) {
      with_func = column_definition.with
    }
    column_ids.push(column_id)
  }

  const where_clause_strings = []
  const having_clause_strings = []
  const unique_column_ids = new Set(column_ids)
  for (const where_clause of where_clauses) {
    const column_definition =
      players_table_column_definitions[where_clause.column_id]
    const where_string = get_where_string({
      where_clause,
      column_definition,
      table_name,
      column_index: 0
    })
    if (column_definition.use_having) {
      having_clause_strings.push(where_string)
    } else {
      where_clause_strings.push(where_string)
    }

    if (column_definition.join) {
      join_func = column_definition.join
    }

    if (column_definition.with) {
      with_func = column_definition.with
    }

    // if use_play_by_play_with (play by play) a select string should be added to the with statement as its needed for the having clause (avoid duplicates for the same column)
    if (
      column_definition.use_play_by_play_with &&
      !unique_column_ids.has(where_clause.column_id)
    ) {
      use_play_by_play_with = true
      pid_column = column_definition.pid_column
      join_func = column_definition.join
      const select_string = get_select_string({
        column_params,
        column_index: 0,
        column_definition,
        table_name
      })
      for (const s of select_string) {
        select_strings.push(s)
      }
    } else if (!unique_column_ids.has(where_clause.column_id)) {
      const select_string = get_select_string({
        column_params,
        column_index: 0,
        column_definition,
        table_name
      })
      for (const s of select_string) {
        select_strings.push(s)
      }
    }
  }

  if (use_play_by_play_with) {
    add_play_by_play_with_statement({
      query: players_query,
      params: column_params,
      with_table_name: table_name,
      having_clauses: having_clause_strings,
      select_strings,
      pid_column
    })

    // add select to players_query for each select_column in the with statement
    for (const { column_id, column_index } of select_columns) {
      const column_definition = players_table_column_definitions[column_id]
      players_query.select(
        `${table_name}.${column_definition.column_name}_0 as ${column_definition.column_name}_${column_index}`
      )
    }
  } else if (with_func) {
    with_func({
      query: players_query,
      params: column_params,
      with_table_name: table_name,
      having_clauses: having_clause_strings
    })

    for (const select_string of select_strings) {
      players_query.select(db.raw(select_string))
    }
  } else {
    if (where_clause_strings.length) {
      players_query.whereRaw(where_clause_strings.join(' AND '))
    }
    if (having_clause_strings.length) {
      players_query.havingRaw(having_clause_strings.join(' AND '))
    }
    for (const select_string of select_strings) {
      players_query.select(db.raw(select_string))
    }
  }

  // join table if needed
  if (join_func) {
    join_func({
      query: players_query,
      table_name,
      params: column_params,
      join_type: where_clauses.length ? 'INNER' : 'LEFT'
    })
  } else if (table_name !== 'player' && table_name !== 'nfl_plays') {
    players_query.leftJoin(table_name, `${table_name}.pid`, 'player.pid')
  }
}

const get_grouped_clauses_by_table = ({
  where: where_clauses,
  table_columns,
  players_table_column_definitions
}) => {
  const grouped_clauses_by_table = {}

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

    if (!grouped_clauses_by_table[table_name]) {
      grouped_clauses_by_table[table_name] = {
        column_params,
        where_clauses: [],
        select_columns: []
      }
    }
    grouped_clauses_by_table[table_name].where_clauses.push(where_clause)
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

    if (!grouped_clauses_by_table[table_name]) {
      grouped_clauses_by_table[table_name] = {
        column_params,
        where_clauses: [],
        select_columns: []
      }
    }

    grouped_clauses_by_table[table_name].select_columns.push({
      column_id,
      column_index
    })
  }

  return grouped_clauses_by_table
}

export default function ({
  where = [],
  columns = [],
  prefix_columns = [],
  sort = [],
  offset = 0,
  limit = 500
} = {}) {
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

  const grouped_clauses_by_table = get_grouped_clauses_by_table({
    where,
    table_columns,
    players_table_column_definitions
  })

  // call joins for where/having first so they are inner joins
  for (const [
    table_name,
    { column_params, where_clauses, select_columns }
  ] of Object.entries(grouped_clauses_by_table)) {
    add_clauses_for_table({
      players_query,
      select_columns,
      where_clauses,
      table_name,
      column_params,
      joined_table_index,
      with_statement_index
    })
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

    if (!column_definition) {
      continue
    }

    const table_name = get_table_name({ column_definition, column_params })

    add_sort_clause({
      players_query,
      sort_clause,
      column_definition,
      column_params,
      table_name,
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
