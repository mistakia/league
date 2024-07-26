import db from '#db'
import players_table_column_definitions from '#libs-server/players-table-column-definitions/index.mjs'
import * as validators from '#libs-server/validators.mjs'
import {
  get_per_game_cte_table_name,
  add_per_game_cte
} from '#libs-server/players-table/rate-type-per-game.mjs'
import { add_defensive_play_by_play_with_statement } from '#libs-server/players-table/add-defensive-play-by-play-with-statement.mjs'
import { add_player_stats_play_by_play_with_statement } from '#libs-server/players-table/add-player-stats-play-by-play-with-statement.mjs'
import { add_team_stats_play_by_play_with_statement } from '#libs-server/players-table/add-team-stats-play-by-play-with-statement.mjs'

const get_rate_type_sql = ({ table_name, column_name, rate_type_table_name }) =>
  `CAST(${table_name}.${column_name} AS DECIMAL) / NULLIF(CAST(${rate_type_table_name}.rate_type_total_count AS DECIMAL), 0)`

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

const get_table_name = ({ column_definition, column_params, splits }) => {
  return column_definition.table_alias
    ? column_definition.table_alias({ params: column_params, splits })
    : column_definition.table_name
}

// TODO update to return an object containing the where_string and values for parameterized query
const get_where_string = ({
  where_clause,
  column_definition,
  table_name,
  column_index = 0
}) => {
  const column_name = column_definition.select_as
    ? column_definition.select_as({ params: where_clause.params })
    : column_definition.column_name
  const where_column = column_definition.where_column
    ? column_definition.where_column({
        table_name,
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

const get_select_string = ({
  column_id,
  column_params,
  column_index,
  column_definition,
  table_name,
  rate_type_column_mapping,
  splits
}) => {
  const rate_type_table_name =
    rate_type_column_mapping[`${column_id}_${column_index}`]
  const column_value = `"${table_name}"."${column_definition.column_name}"`

  const get_select_expression = () => {
    if (rate_type_table_name) {
      return get_rate_type_sql({
        table_name,
        column_name: column_definition.column_name,
        rate_type_table_name
      })
    }
    return column_value
  }

  if (column_definition.select) {
    return {
      select: column_definition.select({
        table_name,
        params: column_params,
        column_index,
        rate_type_table_name,
        splits
      }),
      group_by: column_definition.group_by
        ? column_definition.group_by({
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

  return {
    select: [`${select_expression} AS "${select_as}_${column_index}"`],
    group_by: [
      column_value,
      rate_type_table_name
        ? `${rate_type_table_name}.rate_type_total_count`
        : null
    ].filter(Boolean)
  }
}

const add_sort_clause = ({
  players_query,
  sort_clause,
  column_definition,
  column_params,
  column_index = 0,
  select_position
}) => {
  const sort_direction =
    sort_clause.desc === true || sort_clause.desc === 'true' ? 'DESC' : 'ASC'
  players_query.orderByRaw(`${select_position} ${sort_direction} NULLS LAST`)
}

const add_clauses_for_table = ({
  players_query,
  select_columns = [],
  where_clauses = [],
  table_name,
  column_params = {},
  splits = [],
  year_split_join_clause,
  week_split_join_clause,
  rate_type_column_mapping = {},
  players_table_options
}) => {
  const column_ids = []
  const select_strings = []
  const group_by_strings = []
  let use_player_stats_play_by_play_with = false
  let use_defensive_play_by_play_with = false
  let use_team_stats_play_by_play_with = false

  // the pid column and join_func should be the same among column definitions with the same table name/alias
  let pid_columns = null
  let join_func = null
  let with_func = null

  for (const { column_id, column_index } of select_columns) {
    const column_definition = players_table_column_definitions[column_id]
    const select_result = get_select_string({
      column_id,
      column_params,
      column_index,
      column_definition,
      table_name,
      rate_type_column_mapping,
      splits
    })

    select_strings.push(...select_result.select)
    group_by_strings.push(...select_result.group_by)

    if (column_definition.join) {
      join_func = column_definition.join
    }

    if (column_definition.use_player_stats_play_by_play_with) {
      use_player_stats_play_by_play_with = true
      pid_columns = column_definition.pid_columns
      join_func = column_definition.join
    } else if (column_definition.use_defensive_play_by_play_with) {
      use_defensive_play_by_play_with = true
      pid_columns = column_definition.pid_columns
      join_func = column_definition.join
    } else if (column_definition.use_team_stats_play_by_play_with) {
      use_team_stats_play_by_play_with = true
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

    if (!where_string) {
      continue
    }

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

    if (
      column_definition.use_player_stats_play_by_play_with &&
      !unique_column_ids.has(where_clause.column_id)
    ) {
      use_player_stats_play_by_play_with = true
      pid_columns = column_definition.pid_columns
      join_func = column_definition.join
    }
  }

  if (use_player_stats_play_by_play_with) {
    add_player_stats_play_by_play_with_statement({
      query: players_query,
      params: column_params,
      with_table_name: table_name,
      having_clauses: having_clause_strings,
      select_strings,
      pid_columns,
      splits
    })

    // add select to players_query for each select_column in the with statement
    for (const { column_id, column_index } of select_columns) {
      const column_definition = players_table_column_definitions[column_id]
      const rate_type_table_name =
        rate_type_column_mapping[`${column_id}_${column_index}`]
      if (rate_type_table_name) {
        const rate_type_sql_string = get_rate_type_sql({
          table_name,
          column_name: column_definition.column_name,
          rate_type_table_name
        })
        players_query.select(
          db.raw(
            `${rate_type_sql_string} as ${column_definition.column_name}_${column_index}`
          )
        )
        players_query.groupBy(`${table_name}.${column_definition.column_name}`)
        players_query.groupBy(`${rate_type_table_name}.rate_type_total_count`)
      } else {
        players_query.select(
          `${table_name}.${column_definition.column_name} as ${column_definition.column_name}_${column_index}`
        )
        players_query.groupBy(`${table_name}.${column_definition.column_name}`)
      }
    }
  } else if (use_team_stats_play_by_play_with) {
    const select_column_names = []
    for (const { column_id } of select_columns) {
      const column_definition = players_table_column_definitions[column_id]
      // TODO maybe use column_index here
      select_column_names.push(column_definition.column_name)
    }
    add_team_stats_play_by_play_with_statement({
      query: players_query,
      params: column_params,
      with_table_name: table_name,
      having_clauses: having_clause_strings,
      select_strings,
      splits,
      select_column_names
    })

    // add select to players_query for each select_column in the with statement
    for (const { column_id, column_index } of select_columns) {
      const column_definition = players_table_column_definitions[column_id]
      const rate_type_table_name =
        rate_type_column_mapping[`${column_id}_${column_index}`]
      if (rate_type_table_name) {
        const rate_type_sql_string = get_rate_type_sql({
          table_name,
          column_name: column_definition.column_name,
          rate_type_table_name
        })
        players_query.select(
          db.raw(
            `${rate_type_sql_string} as ${column_definition.column_name}_${column_index}`
          )
        )
        players_query.groupBy(
          `${table_name}_player_team_stats.${column_definition.column_name}`
        )
        players_query.groupBy(`${rate_type_table_name}.rate_type_total_count`)
      } else {
        players_query.select(
          `${table_name}_player_team_stats.${column_definition.column_name} as ${column_definition.column_name}_${column_index}`
        )
        players_query.groupBy(
          `${table_name}_player_team_stats.${column_definition.column_name}`
        )
      }
    }
  } else if (use_defensive_play_by_play_with) {
    add_defensive_play_by_play_with_statement({
      query: players_query,
      params: column_params,
      with_table_name: table_name,
      having_clauses: having_clause_strings,
      select_strings,
      pid_columns,
      splits
    })

    // add select to players_query for each select_column in the with statement
    for (const { column_id, column_index } of select_columns) {
      const column_definition = players_table_column_definitions[column_id]
      const rate_type_table_name =
        rate_type_column_mapping[`${column_id}_${column_index}`]
      if (rate_type_table_name) {
        const rate_type_sql_string = get_rate_type_sql({
          table_name,
          column_name: column_definition.column_name,
          rate_type_table_name
        })
        players_query.select(
          db.raw(
            `${rate_type_sql_string} as ${column_definition.column_name}_${column_index}`
          )
        )
        players_query.groupBy(`${table_name}.${column_definition.column_name}`)
        players_query.groupBy(`${rate_type_table_name}.rate_type_total_count`)
      } else {
        players_query.select(
          `${table_name}.${column_definition.column_name} as ${column_definition.column_name}_${column_index}`
        )
        players_query.groupBy(`${table_name}.${column_definition.column_name}`)
      }
    }
  } else if (with_func) {
    with_func({
      query: players_query,
      params: column_params,
      with_table_name: table_name,
      having_clauses: having_clause_strings,
      splits
    })
    for (const select_string of select_strings) {
      players_query.select(db.raw(select_string))
    }
    for (const group_by_string of group_by_strings) {
      players_query.groupBy(db.raw(group_by_string))
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
    for (const group_by_string of group_by_strings) {
      players_query.groupBy(db.raw(group_by_string))
    }
  }

  // join table if needed
  if (join_func) {
    join_func({
      query: players_query,
      table_name,
      params: column_params,
      join_type: where_clauses.length ? 'INNER' : 'LEFT',
      splits,
      year_split_join_clause,
      week_split_join_clause,
      players_table_options
    })
  } else if (
    table_name !== 'player' &&
    table_name !== 'nfl_plays' &&
    (select_strings.length ||
      where_clause_strings.length ||
      having_clause_strings.length)
  ) {
    players_query.leftJoin(table_name, `${table_name}.pid`, 'player.pid')
  }
}

const get_grouped_clauses_by_table = ({
  where: where_clauses,
  table_columns,
  players_table_column_definitions,
  splits
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
      column_params,
      splits
    })

    if (!grouped_clauses_by_table[table_name]) {
      grouped_clauses_by_table[table_name] = {
        column_params,
        where_clauses: [],
        select_columns: [],
        supported_splits: column_definition.supported_splits || []
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
    const table_name = get_table_name({
      column_definition,
      column_params,
      splits
    })

    if (!grouped_clauses_by_table[table_name]) {
      grouped_clauses_by_table[table_name] = {
        column_params,
        where_clauses: [],
        select_columns: [],
        supported_splits: column_definition.supported_splits || []
      }
    }

    grouped_clauses_by_table[table_name].select_columns.push({
      column_id,
      column_index
    })
  }

  return grouped_clauses_by_table
}

const group_tables_by_supported_splits = (grouped_clauses_by_table, splits) => {
  const grouped_by_splits = {}

  for (const [table_name, table_info] of Object.entries(
    grouped_clauses_by_table
  )) {
    const supported_splits_key = table_info.supported_splits
      .filter((split) => splits.includes(split))
      .sort()
      .join('_')

    if (!grouped_by_splits[supported_splits_key]) {
      grouped_by_splits[supported_splits_key] = {}
    }

    grouped_by_splits[supported_splits_key][table_name] = table_info
  }

  return grouped_by_splits
}

export default function ({
  splits = [],
  where = [],
  columns = [],
  prefix_columns = [],
  sort = [],
  offset = 0,
  limit = 500
} = {}) {
  const validator_result = validators.table_state_validator({
    splits,
    where,
    columns,
    prefix_columns,
    sort,
    offset,
    limit
  })
  if (validator_result !== true) {
    const error_messages = validator_result.map((error) => {
      if (error.field && error.field.startsWith('where[')) {
        const index = error.field.match(/\d+/)[0]
        return `${error.message} (${where[index]?.column_id}, ${where[index]?.operator}, ${where[index]?.value})`
      }
      return error.message
    })
    throw new Error(error_messages.join('\n'))
  }

  const joined_table_index = {}
  const with_statement_index = {}
  const players_query = db('player').select('player.pid')
  const table_columns = []
  const rate_type_tables = {}
  const rate_type_column_mapping = {}
  const players_table_options = {
    opening_days_joined: false,
    nfl_year_week_timestamp_joined: false,
    year_coalesce_args: []
  }

  // sanitize parameters

  // if splits week is enabled — delete all per_game rate_type column params
  if (splits.includes('week')) {
    columns = columns.map((column) => {
      if (
        typeof column === 'object' &&
        column.params &&
        column.params.rate_type &&
        column.params.rate_type[0] === 'per_game'
      ) {
        return { ...column, params: { ...column.params, rate_type: undefined } }
      }
      return column
    })
  }

  for (const [index, column] of [...prefix_columns, ...columns].entries()) {
    table_columns.push({ column, index })
  }

  for (const [index, column] of [...prefix_columns, ...columns].entries()) {
    if (
      typeof column === 'object' &&
      column.params &&
      (Array.isArray(column.params.rate_type)
        ? column.params.rate_type[0] === 'per_game'
        : column.params.rate_type === 'per_game')
    ) {
      const column_definition =
        players_table_column_definitions[column.column_id]
      if (
        !column_definition ||
        !column_definition.supported_rate_types ||
        !column_definition.supported_rate_types.includes('per_game')
      ) {
        continue
      }

      const column_index = get_column_index({
        column_id: column.column_id,
        index,
        columns: table_columns
      })
      const rate_type_table_name = get_per_game_cte_table_name({
        params: column.params
      })
      rate_type_tables[rate_type_table_name] = column.params
      rate_type_column_mapping[`${column.column_id}_${column_index}`] =
        rate_type_table_name
    }
  }

  let year_split_join_clause
  let week_split_join_clause

  for (const [rate_type_table_name, params] of Object.entries(
    rate_type_tables
  )) {
    add_per_game_cte({ players_query, params, rate_type_table_name, splits })
    players_query.leftJoin(
      rate_type_table_name,
      `${rate_type_table_name}.pid`,
      'player.pid'
    )

    year_split_join_clause = `${rate_type_table_name}.year`
    week_split_join_clause = `${rate_type_table_name}.week`
  }

  const grouped_clauses_by_table = get_grouped_clauses_by_table({
    where,
    table_columns,
    players_table_column_definitions,
    splits
  })

  const grouped_by_splits = group_tables_by_supported_splits(
    grouped_clauses_by_table,
    splits
  )

  // place year split tables last
  const sorted_grouped_by_splits = Object.entries(grouped_by_splits)
    .sort(([key_a], [key_b]) => {
      const has_year_a = key_a.includes('year')
      const has_year_b = key_b.includes('year')
      if (has_year_a && !has_year_b) return 1
      if (!has_year_a && has_year_b) return -1
      return 0
    })
    .reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

  for (const [supported_splits_key, tables] of Object.entries(
    sorted_grouped_by_splits
  )) {
    const available_splits = supported_splits_key.split('_').filter(Boolean)

    // TODO setup a more robust sorting system
    // place year_splits_player_age table last to give other tables a chance to setup the opening_days join
    const sorted_tables = Object.entries(tables)
      .sort(([table_name_a], [table_name_b]) => {
        if (table_name_a === 'year_splits_player_age') return 1
        if (table_name_b === 'year_splits_player_age') return -1
        return 0
      })
      .map(([table_name, table_info]) => {
        return [table_name, table_info]
      })

    for (const [
      table_name,
      { column_params, where_clauses, select_columns }
    ] of sorted_tables) {
      const year_select = select_columns.find(
        (col) => players_table_column_definitions[col.column_id]?.year_select
      )
      const week_select = select_columns.find(
        (col) => players_table_column_definitions[col.column_id]?.week_select
      )

      add_clauses_for_table({
        players_query,
        select_columns,
        where_clauses,
        table_name,
        column_params,
        joined_table_index,
        with_statement_index,
        splits: available_splits,
        year_split_join_clause,
        week_split_join_clause,
        rate_type_column_mapping,
        players_table_options
      })

      if (available_splits.includes('year')) {
        if (select_columns.length) {
          const column_definition =
            players_table_column_definitions[select_columns[0].column_id]
          if (column_definition && column_definition.year_select) {
            const year_select_clause = column_definition.year_select({
              table_name,
              splits
            })
            if (year_select_clause) {
              players_table_options.year_coalesce_args.push(year_select_clause)
            }
          } else {
            players_table_options.year_coalesce_args.push(`${table_name}.year`)
          }
        }

        if (table_name !== 'player' && table_name !== 'rosters_players') {
          if (!year_split_join_clause) {
            year_split_join_clause = year_select
              ? players_table_column_definitions[
                  year_select.column_id
                ].year_select({ table_name, splits })
              : `${table_name}.year`
          }

          if (!week_split_join_clause && available_splits.includes('week')) {
            week_split_join_clause = week_select
              ? players_table_column_definitions[
                  week_select.column_id
                ].week_select({ table_name, splits })
              : `${table_name}.week`
          }
        }
      }
    }
  }

  // Add a coalesce select for each split
  for (const split of splits) {
    if (split === 'year') {
      const coalesce_args = Object.entries(grouped_clauses_by_table)
        .filter(
          ([_, table_info]) =>
            table_info.supported_splits &&
            table_info.supported_splits.includes(split)
        )
        .map(([table_alias, table_info]) => {
          // Check if select_columns is not empty
          if (
            table_info.select_columns &&
            table_info.select_columns.length > 0
          ) {
            const column_definition =
              players_table_column_definitions[
                table_info.select_columns[0].column_id
              ]
            if (column_definition && column_definition.year_select) {
              return column_definition.year_select({
                table_name: table_alias,
                splits
              })
            }
          }
          // Default to standard year column if no custom year_select is available
          return `${table_alias}.${split}`
        })
        .filter(Boolean) // Remove any undefined entries
        .join(', ')

      if (coalesce_args) {
        players_query.select(db.raw(`COALESCE(${coalesce_args}) AS year`))
        players_query.groupBy(db.raw(`COALESCE(${coalesce_args})`))
      }
    }

    if (split === 'week') {
      const coalesce_args = Object.entries(grouped_clauses_by_table)
        .filter(
          ([_, table_info]) =>
            table_info.supported_splits &&
            table_info.supported_splits.includes(split)
        )
        .map(([table_alias, table_info]) => {
          // Check if select_columns is not empty and week_select is defined
          if (
            table_info.select_columns &&
            table_info.select_columns.length > 0
          ) {
            const column_definition =
              players_table_column_definitions[
                table_info.select_columns[0].column_id
              ]
            if (column_definition && column_definition.week_select) {
              return column_definition.week_select({
                table_name: table_alias,
                splits
              })
            }
          }
          // Default to standard week column if no custom week_select is available
          return `${table_alias}.week`
        })
        .filter(Boolean) // Remove any undefined entries
        .join(', ')

      if (coalesce_args) {
        players_query.select(db.raw(`COALESCE(${coalesce_args}) AS week`))
        players_query.groupBy(db.raw(`COALESCE(${coalesce_args})`))
      }
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

    if (!column_definition) {
      continue
    }

    const table_name = get_table_name({
      column_definition,
      column_params,
      splits
    })

    // Find the select position for the sort column
    const column_name = column_definition.select_as
      ? column_definition.select_as({ params: column_params })
      : column_definition.column_name

    const column_name_with_index = `${column_name}_${sort_clause.column_index || 0}`

    // Find the select position for the sort column
    const select_position =
      players_query._statements
        .filter((statement) => statement.grouping === 'columns')
        .findIndex((statement) => {
          if (Array.isArray(statement.value)) {
            return statement.value.some((value) => {
              const is_string =
                typeof value.sql === 'string' || typeof value === 'string'
              const query_string = is_string
                ? value.toString()
                : value?.sql?.sql
                  ? value.sql.sql
                  : ''
              return query_string.includes(column_name_with_index)
            })
          }
          return false
        }) + 1 // Add 1 because SQL positions are 1-indexed

    if (select_position > 0) {
      add_sort_clause({
        players_query,
        sort_clause,
        column_definition,
        column_params,
        table_name,
        column_index: sort_clause.column_index,
        select_position
      })
    }
  }

  players_query.orderBy('player.pid', 'asc')

  if (offset) {
    players_query.offset(offset)
  }

  players_query.select('player.pos')

  players_query.groupBy(
    'player.pid',
    'player.lname',
    'player.fname',
    'player.pos'
  )
  players_query.limit(limit)

  console.log(players_query.toString())

  return players_query
}
