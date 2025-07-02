import db from '#db'
import debug from 'debug'
import {
  constants,
  named_scoring_formats,
  named_league_formats
} from '#libs-shared'
import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import * as validators from '#libs-server/validators.mjs'

import {
  get_rate_type_cte_table_name,
  add_rate_type_cte,
  join_rate_type_cte
} from '#libs-server/data-views/rate-type/index.mjs'
import {
  get_main_select_string,
  get_with_select_string
} from '#libs-server/data-views/select-string.mjs'
import {
  get_where_string,
  get_main_where_string,
  get_with_where_string
} from '#libs-server/data-views/where-string.mjs'
import { add_week_opponent_cte_tables } from '#libs-server/data-views/week-opponent-cte-tables.mjs'

const log = debug('data-views')

const rename_rate_type = (rate_type) => {
  const rate_type_mapping = {
    per_team_def_play: 'per_team_play',
    per_team_def_drive: 'per_team_drive',
    per_team_def_series: 'per_team_series',
    per_team_off_play: 'per_team_play',
    per_team_off_pass_play: 'per_team_pass_play',
    per_team_off_rush_play: 'per_team_rush_play',
    per_team_off_drive: 'per_team_drive',
    per_team_off_series: 'per_team_series'
  }

  return rate_type_mapping[rate_type] || rate_type
}

const process_rate_type_backwards_compatibility = (params) => {
  if (params.rate_type) {
    if (Array.isArray(params.rate_type)) {
      params.rate_type = params.rate_type.map(rename_rate_type)
    } else {
      params.rate_type = rename_rate_type(params.rate_type)
    }
  }
  return params
}

const process_cache_info = ({ cache_info, data_view_metadata }) => {
  if (cache_info.cache_ttl < data_view_metadata.cache_ttl) {
    data_view_metadata.cache_ttl = cache_info.cache_ttl
  }

  if (
    cache_info.cache_expire_at &&
    (cache_info.cache_expire_at < data_view_metadata.cache_expire_at ||
      !data_view_metadata.cache_expire_at)
  ) {
    data_view_metadata.cache_expire_at = cache_info.cache_expire_at
  }
}

const resolve_format_hash = ({ format_value, format_type }) => {
  if (!format_value || typeof format_value !== 'string') {
    return format_value
  }

  // If it's already a hash (64-character hex string), return as is
  if (/^[a-f0-9]{64}$/i.test(format_value)) {
    return format_value
  }

  // Try to resolve named format
  if (
    format_type === 'scoring_format_hash' &&
    named_scoring_formats[format_value]
  ) {
    return named_scoring_formats[format_value].hash
  }

  if (
    format_type === 'league_format_hash' &&
    named_league_formats[format_value]
  ) {
    return named_league_formats[format_value].hash
  }

  // Return original value if no match found
  return format_value
}

const process_dynamic_params = (params) => {
  const processed_params = { ...params }

  // Helper function to process individual param
  const process_param = (param, param_key) => {
    if (Array.isArray(param)) {
      return param.map((item) => {
        const processed_item =
          typeof item === 'object' &&
          item !== null &&
          !item.dynamic_type &&
          item.value !== undefined &&
          item.value !== null
            ? item.value
            : item

        // Resolve format hashes
        if (
          param_key === 'scoring_format_hash' ||
          param_key === 'league_format_hash'
        ) {
          return resolve_format_hash({
            format_value: processed_item,
            format_type: param_key
          })
        }

        return processed_item
      })
    }

    let processed_value = param
    if (
      typeof param === 'object' &&
      param !== null &&
      !param.dynamic_type &&
      param.value !== undefined &&
      param.value !== null
    ) {
      processed_value = param.value
    }

    // Resolve format hashes
    if (
      param_key === 'scoring_format_hash' ||
      param_key === 'league_format_hash'
    ) {
      processed_value = resolve_format_hash({
        format_value: processed_value,
        format_type: param_key
      })
    }

    return processed_value
  }

  // Process all params
  for (const key in processed_params) {
    processed_params[key] = process_param(processed_params[key], key)
  }

  // Process year parameter
  if (processed_params.year) {
    processed_params.year = process_dynamic_year_param(processed_params.year)
  }

  // Process week parameter
  if (processed_params.week) {
    processed_params.week = process_dynamic_week_param(processed_params.week)
  }

  if (processed_params.single_week) {
    processed_params.single_week = process_dynamic_single_week_param(
      processed_params.single_week
    )
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
      switch (year.dynamic_type) {
        case 'last_n_years': {
          const n = Number(year.value || 3)
          return Array.from({ length: n }, (_, i) =>
            Math.max(min_year, current_year - i)
          )
        }
        case 'next_n_years': {
          const n = Number(year.value || 3)
          return Array.from({ length: n }, (_, i) =>
            Math.min(max_year, current_year + i + 1)
          )
        }
        case 'current_year':
          return [current_year]
        default:
          return []
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
      switch (week.dynamic_type) {
        case 'last_n_weeks': {
          const n = Number(week.value || 3)
          return Array.from({ length: n }, (_, i) =>
            Math.max(min_week, current_week - i)
          )
        }
        case 'next_n_weeks': {
          const n = Number(week.value || 3)
          return Array.from({ length: n }, (_, i) =>
            Math.min(max_week, current_week + i + 1)
          )
        }
        case 'current_week':
          return [current_week]
        default:
          return []
      }
    }
    const numeric_week = Number(week)
    return isNaN(numeric_week)
      ? []
      : Math.max(min_week, Math.min(max_week, numeric_week))
  })

  return [...new Set(weeks)]
}

const process_dynamic_single_week_param = (single_week_param) => {
  let single_week = Array.isArray(single_week_param)
    ? single_week_param
    : [single_week_param]
  single_week = single_week.map((week) => {
    if (typeof week === 'object') {
      if (week.dynamic_type === 'current_week') {
        return constants.season.week
      }
    }
    return week
  })
  return single_week
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
      year_array.forEach((year) => {
        const parsed_year = parseInt(year)
        if (parsed_year <= constants.season.year) {
          years.add(parsed_year)
        }
      })
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
  const all_years = new Set()
  years.forEach((year) => {
    for (let i = min_offset; i <= max_offset; i++) {
      const offset_year = year + i
      if (offset_year <= constants.season.year) {
        all_years.add(offset_year)
      }
    }
  })

  return Array.from(all_years).sort((a, b) => a - b)
}

const get_column_index = ({ column_id, index, columns }) => {
  const columns_with_same_id = columns.filter(
    ({ column: c }) => (typeof c === 'string' ? c : c.column_id) === column_id
  )
  const found_index = columns_with_same_id.findIndex(
    ({ index: i }) => i === index
  )
  return found_index !== -1 ? found_index : 0
}

const find_sort_column = ({ column_id, column_index = 0, columns }) => {
  // Special handling for split columns
  if (column_id === 'year') {
    return {
      column_id,
      table_name: 'player_years',
      is_split: true
    }
  }

  if (column_id === 'week') {
    return {
      column_id,
      table_name: 'player_years_weeks',
      is_split: true
    }
  }

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

const get_column_name_from_main_select = (column_definition, column_index) => {
  if (!column_definition.main_select) return null

  try {
    // Try to extract the column name from main_select
    const main_select_result = column_definition.main_select({ column_index })
    if (
      !main_select_result ||
      !main_select_result[0] ||
      !main_select_result[0].sql
    )
      return null

    const select_string = main_select_result[0].sql

    // Most column definitions follow the pattern: `... as something_${column_index}`
    const match = select_string.match(
      /\s+as\s+([a-zA-Z0-9_]+)_\$\{column_index\}/
    )
    if (match && match[1]) {
      return match[1]
    }
    return null
  } catch (error) {
    return null
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

const add_clauses_for_table = async ({
  players_query,
  select_columns = [],
  where_clauses = [],
  table_name,
  group_column_params = {},
  splits = [],
  year_split_join_clause,
  week_split_join_clause,
  rate_type_column_mapping = {},
  data_view_options,
  data_view_metadata
}) => {
  const column_ids = []
  const with_select_strings = []
  const select_strings = []
  const group_by_strings = []

  // the pid column and join_func should be the same among column definitions with the same table name/alias
  let pid_columns = null
  let join_func = null
  let with_func = null

  for (const {
    column_id,
    column_index,
    column_params = {}
  } of select_columns) {
    const column_definition = data_views_column_definitions[column_id]
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
      data_views_column_definitions[where_clause.column_id]

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
            table_name,
            column_id: where_clause.column_id,
            column_index: 0,
            rate_type_column_mapping
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
      const column_definition = data_views_column_definitions[column_id]
      // TODO maybe use column_index here
      select_column_names.push(column_definition.column_name)
      if (column_definition.is_rate) {
        rate_columns.push(column_definition.column_name)
      }
    }
    await with_func({
      query: players_query,
      params: group_column_params,
      with_table_name: table_name,
      having_clauses: with_having_clause_strings,
      where_clauses: with_where_clause_strings,
      select_strings: with_select_strings,
      splits,
      pid_columns,
      select_column_names,
      rate_columns,
      data_view_options
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

  // Enhanced join handling with adaptive system
  if (join_func) {
    await join_func({
      query: players_query,
      table_name,
      params: group_column_params,
      join_type: where_clauses.length ? 'INNER' : 'LEFT',
      splits,
      year_split_join_clause,
      week_split_join_clause,
      data_view_options
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
  data_views_column_definitions,
  splits
}) => {
  const grouped_clauses_by_table = {}

  for (const where_clause of where_clauses) {
    const { column_id, params: column_params } = where_clause
    const column_definition = data_views_column_definitions[column_id]

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
        group_column_params: column_params,
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
    const column_definition = data_views_column_definitions[column_id]

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
        group_column_params: column_params,
        where_clauses: [],
        select_columns: [],
        supported_splits: column_definition.supported_splits || []
      }
    }

    grouped_clauses_by_table[table_name].select_columns.push({
      column_id,
      column_index,
      column_params
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

export const get_data_view_results_query = async ({
  splits = [],
  where = [],
  columns = [],
  prefix_columns = [],
  sort = [],
  offset = 0,
  limit = 500
} = {}) => {
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

  // filter where and remove any where clauses that have a value of null or undefined
  where = where.filter((where_clause) => {
    return (
      where_clause.operator === 'IS NULL' ||
      where_clause.operator === 'IS NOT NULL' ||
      (where_clause.value !== null &&
        where_clause.value !== undefined &&
        where_clause.value !== '')
    )
  })

  // backwards compatibility for rate_type
  // process params and convert dynamic params to static
  where = where.map((where_clause) => ({
    ...where_clause,
    params: process_rate_type_backwards_compatibility(
      process_dynamic_params(where_clause.params || {})
    )
  }))

  columns = columns.map((column) => {
    if (typeof column === 'object' && column.params) {
      return {
        ...column,
        params: process_rate_type_backwards_compatibility(
          process_dynamic_params(column.params || {})
        )
      }
    }
    return column
  })

  const joined_table_index = {}
  const with_statement_index = {}
  const players_query = db('player').select('player.pid')
  const table_columns = []
  const rate_type_column_mapping = {}
  const data_view_options = {
    opening_days_joined: false,
    player_seasonlogs_joined: false,
    nfl_year_week_timestamp_joined: false,
    year_coalesce_args: [],
    rate_type_tables: {},
    matchup_opponent_types: new Set()
  }
  const data_view_metadata = {
    created_at: Date.now(),
    cache_ttl: 1000 * 60 * 60 * 24 * 7, // 1 week
    cache_expire_at: null
  }

  let year_split_join_clause
  let week_split_join_clause

  // Check columns for matchup_opponent_type
  for (const column of [...prefix_columns, ...columns]) {
    if (
      typeof column === 'object' &&
      column.params &&
      column.params.matchup_opponent_type
    ) {
      const opponent_type = Array.isArray(column.params.matchup_opponent_type)
        ? column.params.matchup_opponent_type[0] &&
          typeof column.params.matchup_opponent_type[0] === 'object'
          ? null
          : column.params.matchup_opponent_type[0]
        : column.params.matchup_opponent_type
      if (opponent_type !== null) {
        data_view_options.matchup_opponent_types.add(opponent_type)
      }
    }
  }

  // Check where clauses for matchup_opponent_type
  for (const where_clause of where) {
    if (where_clause.params && where_clause.params.matchup_opponent_type) {
      const opponent_type = Array.isArray(
        where_clause.params.matchup_opponent_type
      )
        ? where_clause.params.matchup_opponent_type[0] &&
          typeof where_clause.params.matchup_opponent_type[0] === 'object'
          ? null
          : where_clause.params.matchup_opponent_type[0]
        : where_clause.params.matchup_opponent_type
      if (opponent_type !== null) {
        data_view_options.matchup_opponent_types.add(opponent_type)
      }
    }
  }

  for (const opponent_type of data_view_options.matchup_opponent_types) {
    switch (opponent_type) {
      case 'current_week_opponent_total':
        add_week_opponent_cte_tables({
          players_query,
          table_name: 'current_week_opponents',
          week: constants.season.nfl_seas_week,
          year: constants.season.year,
          seas_type: constants.season.nfl_seas_type
        })
        players_query.join(
          'current_week_opponents',
          'player.current_nfl_team',
          '=',
          'current_week_opponents.nfl_team'
        )
        break

      case 'next_week_opponent_total': {
        const { seas_type: next_week_seas_type, week: next_week } =
          constants.season.calculate_week(constants.season.now.add(1, 'week'))

        add_week_opponent_cte_tables({
          players_query,
          table_name: 'next_week_opponents',
          week: next_week,
          year: constants.season.year,
          seas_type: next_week_seas_type
        })
        players_query.join(
          'next_week_opponents',
          'player.current_nfl_team',
          '=',
          'next_week_opponents.nfl_team'
        )
        break
      }

      default:
        log(`Unsupported matchup_opponent_type: ${opponent_type}`)
        break
    }
  }

  if (splits.includes('week') || splits.includes('year')) {
    const year_range = get_year_range([...prefix_columns, ...columns], where)

    // Create base_years CTE
    players_query.with(
      'base_years',
      db.raw(`SELECT unnest(ARRAY[${year_range.join(',')}]) as year`)
    )

    // Find position filter if it exists
    const position_filter = where.find(
      (clause) =>
        clause.column_id === 'player_position' &&
        (Array.isArray(clause.value)
          ? clause.value.length > 0
          : Boolean(clause.value))
    )

    // Create player_years CTE with optional position filter
    const base_query =
      'SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years'

    if (position_filter) {
      const column_definition = data_views_column_definitions.player_position
      const position_where_string = get_where_string({
        where_clause: position_filter,
        column_definition,
        table_name: 'player',
        column_index: 0,
        is_main_select: false,
        params: position_filter.params || {}
      })

      players_query.with(
        'player_years',
        db.raw(`${base_query} WHERE ${position_where_string}`)
      )
    } else {
      players_query.with('player_years', db.raw(base_query))
    }
  }

  if (splits.includes('week')) {
    // Extract year filter directly from the year_range
    const year_range = get_year_range([...prefix_columns, ...columns], where)
    const single_year_filter = year_range.length === 1 ? year_range[0] : null

    // Create player_years_weeks CTE with optional year filter
    const year_filter_clause = single_year_filter
      ? ` WHERE nfl_year_week_timestamp.year = ${single_year_filter}`
      : ''

    players_query.with(
      'player_years_weeks',
      db.raw(
        `SELECT player_years.pid, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM player_years INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year${year_filter_clause}`
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

  for (const where_item of where) {
    const column_definition =
      data_views_column_definitions[where_item.column_id]
    if (!column_definition) {
      log(`Column definition not found for column_id: ${where_item.column_id}`)
      continue
    }
    if (!column_definition.get_cache_info) {
      log(
        `Column definition does not have get_cache_info method for column_id: ${where_item.column_id}`
      )
      continue
    }
    const cache_info = column_definition.get_cache_info({
      params: where_item.params
    })
    process_cache_info({ cache_info, data_view_metadata })
  }

  for (const [index, column] of [...prefix_columns, ...columns].entries()) {
    table_columns.push({ column, index })

    const column_id = typeof column === 'string' ? column : column.column_id
    const column_definition = data_views_column_definitions[column_id]
    if (!column_definition) {
      log(`Column definition not found for column_id: ${column_id}`)
      continue
    }

    if (!column_definition.get_cache_info) {
      log(
        `Column definition does not have get_cache_info method for column_id: ${column_id}`
      )
      continue
    }
    const cache_info = column_definition.get_cache_info({
      params: column.params
    })
    process_cache_info({ cache_info, data_view_metadata })
  }

  for (const [index, column] of [
    ...prefix_columns,
    ...columns,
    ...where
  ].entries()) {
    if (
      typeof column === 'object' &&
      column.params &&
      column.params.rate_type
    ) {
      const rate_type = Array.isArray(column.params.rate_type)
        ? column.params.rate_type[0]
        : column.params.rate_type

      const column_definition = data_views_column_definitions[column.column_id]
      if (
        !column_definition ||
        !column_definition.supported_rate_types ||
        !column_definition.supported_rate_types.includes(rate_type)
      ) {
        continue
      }

      const column_index = get_column_index({
        column_id: column.column_id,
        index,
        columns: table_columns
      })
      const rate_type_table_name = get_rate_type_cte_table_name({
        params: column.params,
        rate_type,
        team_unit: column_definition.team_unit,
        is_team: column_definition.is_team
      })
      data_view_options.rate_type_tables[rate_type_table_name] = {
        params: column.params,
        rate_type,
        team_unit: column_definition.team_unit,
        is_team: column_definition.is_team
      }
      rate_type_column_mapping[`${column.column_id}_${column_index}`] =
        rate_type_table_name
    }
  }

  for (const [
    rate_type_table_name,
    { params, rate_type, team_unit, is_team }
  ] of Object.entries(data_view_options.rate_type_tables)) {
    add_rate_type_cte({
      players_query,
      params,
      rate_type_table_name,
      splits,
      rate_type,
      team_unit,
      is_team
    })
    join_rate_type_cte({
      players_query,
      params,
      rate_type_table_name,
      splits,
      year_split_join_clause,
      rate_type,
      team_unit,
      is_team
    })
  }

  const grouped_clauses_by_table = get_grouped_clauses_by_table({
    where,
    table_columns,
    data_views_column_definitions,
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
      { group_column_params = {}, where_clauses, select_columns }
    ] of sorted_tables) {
      const year_select = select_columns.find(
        (col) => data_views_column_definitions[col.column_id]?.year_select
      )
      const week_select = select_columns.find(
        (col) => data_views_column_definitions[col.column_id]?.week_select
      )

      await add_clauses_for_table({
        players_query,
        select_columns,
        where_clauses,
        table_name,
        group_column_params,
        joined_table_index,
        with_statement_index,
        splits: available_splits,
        year_split_join_clause,
        week_split_join_clause,
        rate_type_column_mapping,
        data_view_options,
        data_view_metadata
      })

      if (available_splits.includes('year')) {
        const has_year_offset_range =
          group_column_params.year_offset &&
          Array.isArray(group_column_params.year_offset) &&
          group_column_params.year_offset.length > 1 &&
          group_column_params.year_offset[0] !==
            group_column_params.year_offset[1]
        if (select_columns.length && !has_year_offset_range) {
          const column_definition =
            data_views_column_definitions[select_columns[0].column_id]
          if (column_definition && column_definition.year_select) {
            const year_select_clause = column_definition.year_select({
              table_name,
              splits,
              column_params: group_column_params
            })
            if (year_select_clause) {
              data_view_options.year_coalesce_args.push(year_select_clause)
            }
          } else {
            data_view_options.year_coalesce_args.push(`${table_name}.year`)
          }
        }

        if (table_name !== 'player' && table_name !== 'rosters_players') {
          if (!year_split_join_clause) {
            const year_offset = group_column_params.year_offset
            const year_offset_single = Array.isArray(year_offset)
              ? year_offset[0]
              : year_offset
            year_split_join_clause = year_select
              ? data_views_column_definitions[
                  year_select.column_id
                ].year_select({
                  table_name,
                  splits,
                  column_params: group_column_params
                })
              : year_offset_single
                ? `${table_name}.year - ${year_offset_single}`
                : `${table_name}.year`
          }

          if (!week_split_join_clause && available_splits.includes('week')) {
            week_split_join_clause = week_select
              ? data_views_column_definitions[
                  week_select.column_id
                ].week_select({
                  table_name,
                  splits,
                  column_params: group_column_params
                })
              : `${table_name}.week`
          }
        }
      }
    }
  }

  // Add a select and group by for each split
  for (const split of splits) {
    if (split === 'year') {
      players_query.select('player_years.year')
      players_query.groupBy('player_years.year')
    }

    if (split === 'week') {
      players_query.select('player_years_weeks.week')
      players_query.groupBy('player_years_weeks.week')
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

    // Special handling for split columns
    if (column.is_split) {
      const sort_direction =
        sort_clause.desc === true || sort_clause.desc === 'true'
          ? 'DESC'
          : 'ASC'
      players_query.orderByRaw(
        `${column.table_name}.${column.column_id} ${sort_direction} NULLS LAST`
      )
      continue
    }

    const column_id = typeof column === 'string' ? column : column.column_id
    const column_params = typeof column === 'string' ? {} : column.params
    const column_definition = data_views_column_definitions[column_id]

    if (!column_definition) {
      console.warn(`Column definition not found for column_id: ${column_id}`)
      continue
    }

    const table_name = get_table_name({
      column_definition,
      column_params,
      splits
    })

    // Find column name for sorting through various methods
    let column_name = null
    let select_position = 0

    // Method 1: Check for explicit sort_column_name in the column definition
    // This provides a direct way for column definitions to specify how they should be sorted
    if (column_definition.sort_column_name) {
      // sort_column_name can be a string or a function that returns a string
      column_name =
        typeof column_definition.sort_column_name === 'function'
          ? column_definition.sort_column_name({
              column_index: sort_clause.column_index || 0,
              params: column_params
            })
          : column_definition.sort_column_name
    }
    // Method 2: Use select_as if defined
    else if (column_definition.select_as) {
      column_name = column_definition.select_as({ params: column_params })
    }
    // Method 3: Use direct column_name if defined
    else if (column_definition.column_name) {
      column_name = column_definition.column_name
    }
    // Method 4: Extract from main_select
    else if (column_definition.main_select) {
      column_name = get_column_name_from_main_select(
        column_definition,
        sort_clause.column_index || 0
      )
    }

    // Format the column name with index if we have one
    const column_name_with_index = column_name
      ? `${column_name}_${sort_clause.column_index || 0}`
      : null

    // Default search by column name with index
    if (column_name_with_index) {
      select_position = find_column_position(
        players_query,
        column_name_with_index
      )
    }
    // Fallback to SQL pattern search
    else if (column_definition.main_select) {
      try {
        const main_select = column_definition.main_select({
          column_index: sort_clause.column_index || 0
        })
        if (main_select && main_select[0] && main_select[0].sql) {
          const sql_pattern = main_select[0].sql
          const pattern_without_as = sql_pattern.replace(
            /\s+as\s+[a-zA-Z0-9_]+_\$\{column_index\}/,
            ''
          )
          const resolved_pattern = pattern_without_as.replace(
            /\$\{column_index\}/g,
            sort_clause.column_index || 0
          )

          select_position = find_column_position(
            players_query,
            resolved_pattern
          )
        }
      } catch (error) {
        // Ignore extraction errors
      }
    }

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

  return {
    data_view_metadata,
    query: players_query
  }
}

export default async function ({
  splits = [],
  where = [],
  columns = [],
  prefix_columns = [],
  sort = [],
  offset = 0,
  limit = 500,
  timeout = null,
  calculate_total_count = true
} = {}) {
  const { query, data_view_metadata } = await get_data_view_results_query({
    splits,
    where,
    columns,
    prefix_columns,
    sort,
    offset,
    limit
  })

  const data_view_query_string = query.toString()
  console.log(data_view_query_string)

  let total_count = null

  // Only calculate total count if requested
  if (calculate_total_count) {
    // Create a count query to get the total number of rows
    const count_query = query.clone()
    // Remove limit and offset from count query
    count_query.clear('limit').clear('offset')
    // Wrap the query in a count
    const count_wrapper_query = db.raw(
      `SELECT COUNT(*) as total_count FROM (${count_query.toString()}) as count_query`
    )

    if (timeout) {
      // Execute count query with timeout
      const count_timeout_query = `SET LOCAL statement_timeout = ${timeout};`
      const full_count_query = `${count_timeout_query} ${count_wrapper_query.toString()};`
      const count_response = await db.raw(full_count_query)
      total_count = parseInt(count_response[1].rows[0].total_count, 10)
    } else {
      // Execute count query
      const count_result = await count_wrapper_query
      total_count = parseInt(count_result.rows[0].total_count, 10)
    }
  }

  if (timeout) {
    const query_string = query.toString()
    const timeout_query = `SET LOCAL statement_timeout = ${timeout};`
    const full_query = `${timeout_query} ${query_string};`

    const response = await db.raw(full_query)
    const data_view_results = response[1].rows

    return {
      data_view_results,
      data_view_metadata: {
        ...data_view_metadata,
        ...(total_count !== null ? { total_count } : {})
      },
      data_view_query_string
    }
  }

  const data_view_results = await query

  return {
    data_view_results,
    data_view_metadata: {
      ...data_view_metadata,
      ...(total_count !== null ? { total_count } : {})
    },
    data_view_query_string
  }
}

// Helper function to find column position in query statements
function find_column_position(query, pattern) {
  const column_statements = query._statements.filter(
    (statement) => statement.grouping === 'columns'
  )

  for (let i = 0; i < column_statements.length; i++) {
    const statement = column_statements[i]
    if (!Array.isArray(statement.value)) continue

    const found = statement.value.some((value) => {
      const query_string =
        typeof value === 'string'
          ? value
          : typeof value.sql === 'string'
            ? value.sql
            : value?.sql?.sql || ''

      return query_string.includes(pattern)
    })

    if (found) {
      return i + 1 // +1 because SQL positions are 1-indexed
    }
  }

  return 0 // Not found
}
