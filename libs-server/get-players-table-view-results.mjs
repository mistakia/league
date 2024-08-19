import db from '#db'
import { constants } from '#libs-shared'
import players_table_column_definitions from '#libs-server/players-table-column-definitions/index.mjs'
import * as validators from '#libs-server/validators.mjs'
import {
  get_per_game_cte_table_name,
  add_per_game_cte,
  join_per_game_cte
} from '#libs-server/players-table/rate-type-per-game.mjs'
import {
  get_main_select_string,
  get_with_select_string
} from '#libs-server/players-table/select-string.mjs'
import {
  get_main_where_string,
  get_with_where_string
} from '#libs-server/players-table/where-string.mjs'

const process_dynamic_params = (params) => {
  const processed_params = { ...params }

  // Process year parameter
  if (params.year) {
    processed_params.year = process_dynamic_year_param(params.year)
  }

  // Process week parameter
  if (params.week) {
    processed_params.week = process_dynamic_week_param(params.week)
  }

  return processed_params
}

const process_dynamic_year_param = (year_param) => {
  let years = Array.isArray(year_param) ? year_param : [year_param]
  const current_year = constants.season.year
  const max_year = constants.season.year
  const min_year = 2000

  years = years.flatMap((year) => {
    if (typeof year === 'object') {
      if (year.dynamic_type === 'last_n_years') {
        const n = Number(year.value || 3)
        return Array.from({ length: n }, (_, i) =>
          Math.max(min_year, current_year - i)
        )
      } else if (year.dynamic_type === 'next_n_years') {
        const n = Number(year.value || 3)
        return Array.from({ length: n }, (_, i) =>
          Math.min(max_year, current_year + i + 1)
        )
      }
    }
    const numeric_year = Number(year)
    return isNaN(numeric_year)
      ? []
      : Math.max(min_year, Math.min(max_year, numeric_year))
  })

  return [...new Set(years)]
}

const process_dynamic_week_param = (week_param) => {
  let weeks = Array.isArray(week_param) ? week_param : [week_param]
  const current_week = constants.season.week
  // TODO get max_week from db based on year
  const max_week = 18
  const min_week = 0

  weeks = weeks.flatMap((week) => {
    if (typeof week === 'object') {
      if (week.dynamic_type === 'last_n_weeks') {
        const n = Number(week.value || 3)
        return Array.from({ length: n }, (_, i) =>
          Math.max(min_week, current_week - i)
        )
      } else if (week.dynamic_type === 'next_n_weeks') {
        const n = Number(week.value || 3)
        return Array.from({ length: n }, (_, i) =>
          Math.min(max_week, current_week + i + 1)
        )
      }
    }
    const numeric_week = Number(week)
    return isNaN(numeric_week)
      ? []
      : Math.max(min_week, Math.min(max_week, numeric_week))
  })

  return [...new Set(weeks)]
}

const get_year_range = (columns, where) => {
  const years = new Set()
  let min_offset = 0
  let max_offset = 0

  const check_params = (params) => {
    if (params.year) {
      const year_array = Array.isArray(params.year)
        ? params.year
        : [params.year]
      year_array.forEach((year) => years.add(parseInt(year)))
    }
    if (params.year_offset) {
      const offset = Array.isArray(params.year_offset)
        ? params.year_offset
        : [params.year_offset]
      min_offset = Math.min(min_offset, Math.min(...offset))
      max_offset = Math.max(max_offset, Math.max(...offset))
    }
  }

  columns.forEach((column) => {
    if (typeof column === 'object' && column.params) {
      check_params(column.params)
    }
  })

  where.forEach((clause) => {
    if (clause.params) {
      check_params(clause.params)
    }
  })

  // If no years are set, use all years from 2000 to the current year
  if (years.size === 0) {
    for (let year = 2000; year <= constants.season.year; year++) {
      years.add(year)
    }
  }

  // Add offset years
  const all_years = new Set(years)
  years.forEach((year) => {
    for (let i = min_offset; i <= max_offset; i++) {
      all_years.add(year + i)
    }
  })

  return Array.from(all_years).sort((a, b) => a - b)
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

const get_table_name = ({ column_definition, column_params, splits }) => {
  return column_definition.table_alias
    ? column_definition.table_alias({ params: column_params, splits })
    : column_definition.table_name
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
  const with_select_strings = []
  const select_strings = []
  const group_by_strings = []

  // the pid column and join_func should be the same among column definitions with the same table name/alias
  let pid_columns = null
  let join_func = null
  let with_func = null

  for (const { column_id, column_index } of select_columns) {
    const column_definition = players_table_column_definitions[column_id]
    const main_select_result = get_main_select_string({
      column_id,
      column_params,
      column_index,
      column_definition,
      table_name,
      rate_type_column_mapping,
      splits
    })

    select_strings.push(...main_select_result.select)
    group_by_strings.push(...main_select_result.group_by)

    if (column_definition.join) {
      join_func = column_definition.join
    }

    if (column_definition.with) {
      with_func = column_definition.with
      pid_columns = column_definition.pid_columns

      const with_select_result = get_with_select_string({
        column_id,
        column_params,
        column_index,
        column_definition,
        table_name,
        rate_type_column_mapping,
        splits
      })
      with_select_strings.push(...with_select_result.select)
      group_by_strings.push(...with_select_result.group_by)
    }

    column_ids.push(column_id)
  }

  const unique_column_ids = new Set(column_ids)
  const main_where_clause_strings = []
  const main_having_clause_strings = []

  // with statements only have having clauses as of now
  const with_having_clause_strings = []
  const with_where_clause_strings = []

  for (const where_clause of where_clauses) {
    const column_definition =
      players_table_column_definitions[where_clause.column_id]

    if (column_definition.join) {
      join_func = column_definition.join
    }

    if (column_definition.with) {
      with_func = column_definition.with
      pid_columns = column_definition.pid_columns

      const with_filter_string = get_with_where_string({
        where_clause,
        column_definition,
        table_name,
        column_index: 0,
        params: where_clause.params,
        rate_type_column_mapping,
        splits
      })

      // add with selects for columns that are not in the select_columns
      if (!unique_column_ids.has(where_clause.column_id)) {
        unique_column_ids.add(where_clause.column_id)

        const with_select_result = get_with_select_string({
          column_id: where_clause.column_id,
          column_params: where_clause.params,
          column_index: 0,
          column_definition,
          table_name,
          rate_type_column_mapping,
          splits
        })
        with_select_strings.push(...with_select_result.select)
        group_by_strings.push(...with_select_result.group_by)
      }

      if (with_filter_string) {
        if (column_definition.use_having) {
          with_having_clause_strings.push(with_filter_string)
        } else {
          with_where_clause_strings.push(with_filter_string)
        }
        // when there is a with statement and a where clause is set there is no need to add the where clause to the main query
        continue
      }
    }

    const main_where_string = get_main_where_string({
      where_clause,
      column_definition,
      table_name,
      column_index: 0,
      params: where_clause.params,
      rate_type_column_mapping,
      splits
    })

    if (main_where_string) {
      if (column_definition.use_having) {
        main_having_clause_strings.push(main_where_string)
      } else {
        main_where_clause_strings.push(main_where_string)
      }

      if (column_definition.main_where_group_by) {
        const main_where_group_by_string =
          column_definition.main_where_group_by({
            params: where_clause.params,
            table_name
          })
        if (main_where_group_by_string) {
          group_by_strings.push(main_where_group_by_string)
        }
      }
    }
  }

  if (with_func) {
    // used by team stats column definitions
    const select_column_names = []
    const rate_columns = []
    for (const column_id of unique_column_ids) {
      const column_definition = players_table_column_definitions[column_id]
      // TODO maybe use column_index here
      select_column_names.push(column_definition.column_name)
      if (column_definition.is_rate) {
        rate_columns.push(column_definition.column_name)
      }
    }
    with_func({
      query: players_query,
      params: column_params,
      with_table_name: table_name,
      having_clauses: with_having_clause_strings,
      where_clauses: with_where_clause_strings,
      select_strings: with_select_strings,
      splits,
      pid_columns,
      select_column_names,
      rate_columns
    })
    for (const select_string of select_strings) {
      players_query.select(db.raw(select_string))
    }
    for (const group_by_string of group_by_strings) {
      players_query.groupBy(db.raw(group_by_string))
    }
  } else {
    for (const select_string of select_strings) {
      players_query.select(db.raw(select_string))
    }
    for (const group_by_string of group_by_strings) {
      players_query.groupBy(db.raw(group_by_string))
    }
  }

  if (main_where_clause_strings.length) {
    players_query.whereRaw(main_where_clause_strings.join(' AND '))
  }
  if (main_having_clause_strings.length) {
    players_query.havingRaw(main_having_clause_strings.join(' AND '))
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
      main_where_clause_strings.length ||
      main_having_clause_strings.length)
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

  // process params and convert dynamic params to static
  where = where.map((where_clause) => ({
    ...where_clause,
    params: process_dynamic_params(where_clause.params || {})
  }))

  columns = columns.map((column) => {
    if (typeof column === 'object' && column.params) {
      return {
        ...column,
        params: process_dynamic_params(column.params || {})
      }
    }
    return column
  })

  const joined_table_index = {}
  const with_statement_index = {}
  const players_query = db('player').select('player.pid')
  const table_columns = []
  const rate_type_column_mapping = {}
  const players_table_options = {
    opening_days_joined: false,
    nfl_year_week_timestamp_joined: false,
    year_coalesce_args: [],
    rate_type_tables: {}
  }

  let year_split_join_clause
  let week_split_join_clause

  if (splits.includes('week') || splits.includes('year')) {
    const year_range = get_year_range([...prefix_columns, ...columns], where)

    players_query.with(
      'base_years',
      db.raw(`SELECT unnest(ARRAY[${year_range.join(',')}]) as year`)
    )
    players_query.with(
      'player_years',
      db.raw(
        'SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years'
      )
    )
  }

  if (splits.includes('week')) {
    players_query.with(
      'player_years_weeks',
      db.raw(
        `SELECT player_years.pid, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM player_years INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year`
      )
    )

    // Modify the main query to start from player_years_weeks
    players_query.from('player_years_weeks')
    players_query.join('player', 'player.pid', 'player_years_weeks.pid')
    players_query.join('player_years', function () {
      this.on('player_years.pid', 'player.pid')
      this.on('player_years.year', 'player_years_weeks.year')
    })

    week_split_join_clause = 'player_years_weeks.week'

    if (splits.includes('year')) {
      year_split_join_clause = `player_years_weeks.year`
    }
  } else if (splits.includes('year')) {
    // Modify the main query to start from player_years
    players_query.from('player_years')
    players_query.join('player', 'player.pid', 'player_years.pid')

    year_split_join_clause = 'player_years.year'
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
      players_table_options.rate_type_tables[rate_type_table_name] =
        column.params
      rate_type_column_mapping[`${column.column_id}_${column_index}`] =
        rate_type_table_name
    }
  }

  for (const [rate_type_table_name, params] of Object.entries(
    players_table_options.rate_type_tables
  )) {
    add_per_game_cte({ players_query, params, rate_type_table_name, splits })
    join_per_game_cte({
      players_query,
      params,
      rate_type_table_name,
      splits,
      year_split_join_clause
    })
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
      { column_params = {}, where_clauses, select_columns }
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
        const has_year_offset_range =
          column_params.year_offset &&
          Array.isArray(column_params.year_offset) &&
          column_params.year_offset.length > 1 &&
          column_params.year_offset[0] !== column_params.year_offset[1]
        if (select_columns.length && !has_year_offset_range) {
          const column_definition =
            players_table_column_definitions[select_columns[0].column_id]
          if (column_definition && column_definition.year_select) {
            const year_select_clause = column_definition.year_select({
              table_name,
              splits,
              column_params
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
            const year_offset = column_params.year_offset
            const year_offset_single = Array.isArray(year_offset)
              ? year_offset[0]
              : year_offset
            year_split_join_clause = year_select
              ? players_table_column_definitions[
                  year_select.column_id
                ].year_select({ table_name, splits, column_params })
              : year_offset_single
                ? `${table_name}.year - ${year_offset_single}`
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
      players_query.select('player_years.year')
      players_query.groupBy('player_years.year')
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

    // Add a check to ensure column is not null
    if (!column) {
      console.warn(
        `Sort column not found for column_id: ${sort_clause.column_id}`
      )
      continue
    }

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
