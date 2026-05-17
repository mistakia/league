import db from '#db'
import debug from 'debug'
import { named_scoring_formats, named_league_formats } from '#libs-shared'
import {
  format_nfl_week_identifier,
  parse_nfl_week_identifier,
  apply_year_offset_to_nfl_weeks,
  decompose_nfl_weeks,
  get_nfl_week_identifiers_for_year,
  get_max_weeks_for_season_type,
  current_nfl_week_identifier,
  nfl_week_offset_params
} from '#libs-shared/nfl-week-identifier.mjs'
import { current_season } from '#constants'
import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import * as validators from '#libs-server/validators.mjs'

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
import { build_query_context } from '#libs-server/data-views/query-context.mjs'
import { normalize_columns } from '#libs-server/data-views/normalize-output-param.mjs'
import { apply_output_aggregator } from '#libs-server/data-views/output-aggregator-registry.mjs'
import { flush as flush_measure_batches } from '#libs-server/data-views/output-aggregator/measure-batch.mjs'
import { build_batched_period_cte } from '#libs-server/data-views/output-aggregator/build-period-cte.mjs'
import {
  get_identity,
  resolve_references
} from '#libs-server/data-views/identities.mjs'
import { resolve as resolve_bridge } from '#libs-server/data-views/identity-bridge-registry.mjs'
import { attach_source } from '#libs-server/data-views/source-attach/dispatcher.mjs'

// A base identity in granularity (e.g. `player`) means the column needs no
// split joins; the column reads from the base table directly.
const derive_supported_splits_from_granularity = (granularity = []) => {
  const supports = new Set()
  let has_base = false
  for (const id of granularity) {
    const identity = get_identity(id)
    if (identity.splits.length === 0) has_base = true
    for (const split of identity.splits) supports.add(split)
  }
  if (has_base) return []
  return Array.from(supports)
}

const is_team_column_definition = (column_definition) =>
  (column_definition.granularity || []).some((g) => g.startsWith('team'))

let column_param_backwards_compatibility_mappings = {}

try {
  column_param_backwards_compatibility_mappings = (
    await import(
      '#private/column-param-backwards-compatibility-mappings.json',
      { with: { type: 'json' } }
    )
  ).default
} catch (error) {
  // File does not exist or failed to load
  console.warn(
    'Backwards compatibility mappings file not found, using empty mapping'
  )
  column_param_backwards_compatibility_mappings = {}
}

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

const process_column_param_backwards_compatibility = (params) => {
  if (!params || typeof params !== 'object') return params

  const transformed_params = { ...params }
  const mappings = column_param_backwards_compatibility_mappings

  // Apply backwards compatibility transformations
  Object.entries(mappings).forEach(
    ([legacy_param_name, current_param_name]) => {
      if (legacy_param_name in transformed_params) {
        // Log for monitoring deprecated parameter usage
        log(
          `Column parameter backwards compatibility: transforming "${legacy_param_name}" to "${current_param_name}"`
        )

        transformed_params[current_param_name] =
          transformed_params[legacy_param_name]
        delete transformed_params[legacy_param_name]
      }
    }
  )

  return transformed_params
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

  // Process nfl_week parameter (before year/week so it can set decomposed values)
  resolve_nfl_week_params(processed_params)

  // Process year parameter (for season-level columns that still use year directly)
  if (processed_params.year && !processed_params.nfl_week_id) {
    processed_params.year = process_dynamic_year_param(processed_params.year)
  }

  // Process week parameter (for season-level columns that still use week directly)
  if (processed_params.week && !processed_params.nfl_week_id) {
    processed_params.week = process_dynamic_week_param(
      processed_params.week,
      processed_params.year
    )
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
  const current_year = current_season.stats_season_year
  const max_year = current_season.year
  const min_year = 2000

  years = years.flatMap((year) => {
    if (typeof year === 'object') {
      switch (year.dynamic_type) {
        case 'last_n_years': {
          const n = parseInt(year.value || 3, 10)
          return Array.from({ length: n }, (_, i) =>
            Math.max(min_year, current_year - i)
          )
        }
        case 'next_n_years': {
          const n = parseInt(year.value || 3, 10)
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
    const numeric_year = parseInt(year, 10)
    return isNaN(numeric_year)
      ? []
      : Math.max(min_year, Math.min(max_year, numeric_year))
  })

  return [...new Set(years)]
}

const process_dynamic_week_param = (week_param, year_param) => {
  let weeks = Array.isArray(week_param) ? week_param : [week_param]
  const current_week = current_season.week
  const years = Array.isArray(year_param)
    ? year_param
    : year_param != null
      ? [year_param]
      : [current_season.year]
  const max_week = years.reduce(
    (acc, y) =>
      Math.max(
        acc,
        get_max_weeks_for_season_type({
          seas_type: 'REG',
          year: parseInt(y, 10)
        })
      ),
    0
  )
  const min_week = 0

  weeks = weeks.flatMap((week) => {
    if (typeof week === 'object') {
      switch (week.dynamic_type) {
        case 'last_n_weeks': {
          const n = parseInt(week.value || 3, 10)
          return Array.from({ length: n }, (_, i) =>
            Math.max(min_week, current_week - i)
          )
        }
        case 'next_n_weeks': {
          const n = parseInt(week.value || 3, 10)
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
    const numeric_week = parseInt(week, 10)
    return isNaN(numeric_week)
      ? []
      : Math.max(min_week, Math.min(max_week, numeric_week))
  })

  return [...new Set(weeks)]
}

const process_dynamic_nfl_week_param = (nfl_week_param) => {
  let nfl_weeks = Array.isArray(nfl_week_param)
    ? nfl_week_param
    : [nfl_week_param]

  nfl_weeks = nfl_weeks.flatMap((item) => {
    if (typeof item === 'object' && item !== null) {
      switch (item.dynamic_type) {
        case 'current_year_reg_weeks': {
          return get_nfl_week_identifiers_for_year({
            year: current_season.stats_season_year,
            seas_type: 'REG'
          })
        }
        case 'current_nfl_week': {
          return [current_nfl_week_identifier()]
        }
        case 'last_n_nfl_weeks': {
          const n = parseInt(item.value || 5, 10)
          const result = []
          for (let i = 0; i < n; i++) {
            const params = nfl_week_offset_params({ offset: -i })
            if (!params) break
            result.push(format_nfl_week_identifier(params))
          }
          return result
        }
        case 'last_n_nfl_years': {
          const n = parseInt(item.value || 3, 10)
          const result = []
          for (let i = 0; i < n; i++) {
            const y = current_season.year - i
            if (y < 2000) break
            result.push(...get_nfl_week_identifiers_for_year({ year: y }))
          }
          return result
        }
        default:
          return []
      }
    }

    if (
      typeof item === 'string' &&
      parse_nfl_week_identifier({ identifier: item })
    ) {
      return [item]
    }

    return []
  })

  return [...new Set(nfl_weeks)]
}

const resolve_nfl_week_params = (params) => {
  if (!params.nfl_week_id) return

  // Resolve dynamic nfl_week_id values
  params.nfl_week_id = process_dynamic_nfl_week_param(params.nfl_week_id)

  if (!params.nfl_week_id.length) return

  // Decompose BEFORE offset expansion to get base year/week/seas_type
  // These base values are used by data-view-join-function.mjs which applies
  // year_offset independently via SQL arithmetic -- using post-offset years
  // would double-apply the offset
  const base_decomposed = decompose_nfl_weeks({
    nfl_weeks: params.nfl_week_id
  })
  params.year = base_decomposed.years
  params.week = base_decomposed.weeks
  params.seas_type = base_decomposed.seas_types

  // Apply year_offset to expand the nfl_week_id array
  if (params.year_offset) {
    params.nfl_week_id = apply_year_offset_to_nfl_weeks({
      nfl_weeks: params.nfl_week_id,
      year_offset: params.year_offset
    })
  }
}

const process_dynamic_single_week_param = (single_week_param) => {
  let single_week = Array.isArray(single_week_param)
    ? single_week_param
    : [single_week_param]
  single_week = single_week.map((week) => {
    if (typeof week === 'object') {
      if (week.dynamic_type === 'current_week') {
        return current_season.week
      }
    }
    return week
  })
  return single_week
}

const process_params_with_backwards_compatibility = (params) => {
  if (!params || typeof params !== 'object') return params

  return process_column_param_backwards_compatibility(
    process_rate_type_backwards_compatibility(process_dynamic_params(params))
  )
}

const process_item_params = (item) => {
  if (typeof item === 'object' && item.params) {
    return {
      ...item,
      params: process_params_with_backwards_compatibility(item.params)
    }
  }
  return item
}

const get_year_range = (columns, where) => {
  const years = new Set()

  const check_params = (params) => {
    if (params.year) {
      const year_array = Array.isArray(params.year)
        ? params.year
        : [params.year]
      year_array.forEach((year) => {
        const parsed_year = parseInt(year, 10)
        if (parsed_year <= current_season.year) {
          years.add(parsed_year)
        }
      })
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
    for (let year = 2000; year <= current_season.year; year++) {
      years.add(year)
    }
  }

  return Array.from(years).sort((a, b) => a - b)
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

/**
 * Determines the optimal from table based on sort configuration and splits
 * @param {Object} params - Parameters object
 * @param {Array} params.sort - Sort configuration from user request
 * @param {Array} params.columns - Column configurations
 * @param {Array} params.prefix_columns - Prefix column configurations
 * @param {Array} params.splits - Active split dimensions ['year', 'week']
 * @param {Object} params.data_views_column_definitions - Column definition registry
 * @returns {Object} From table information
 */
const determine_from_table = ({
  sort = [],
  columns,
  prefix_columns,
  splits,
  data_views_column_definitions
}) => {
  // If no sort columns, use default behavior
  if (!sort || sort.length === 0) {
    return {
      from_table_name: null,
      from_table_type: 'default'
    }
  }

  const first_sort = sort[0]
  const table_columns = [...prefix_columns, ...columns].map(
    (column, index) => ({ column, index })
  )

  const sort_column = find_sort_column({
    column_id: first_sort.column_id,
    column_index: first_sort.column_index || 0,
    columns: table_columns
  })

  // Handle split columns - we no longer use split tables as from tables
  if (sort_column && sort_column.is_split) {
    return {
      from_table_name: null,
      from_table_type: 'default'
    }
  }

  // If sort column is not in the selected columns, use default from table.
  // CTE-based columns require being selected to have their WITH clause generated,
  // and the sort itself will be skipped later when find_sort_column returns null.
  if (!sort_column) {
    return {
      from_table_name: null,
      from_table_type: 'default'
    }
  }

  // Find the column definition for the sort column
  const column_id =
    typeof sort_column === 'string' ? sort_column : sort_column.column_id

  const column_params =
    typeof sort_column === 'object' ? sort_column.params : {}
  const column_definition = data_views_column_definitions[column_id]

  if (!column_definition) {
    return {
      from_table_name: null,
      from_table_type: 'default'
    }
  }

  // Check if this column generates a CTE (WITH statement)
  if (column_definition.with) {
    const table_name = get_table_name({
      column_definition,
      column_params,
      splits
    })
    return {
      from_table_name: table_name,
      from_table_type: 'cte',
      column_id,
      column_params
    }
  }

  // Regular table column
  const table_name = get_table_name({
    column_definition,
    column_params,
    splits
  })
  return {
    from_table_name: table_name,
    from_table_type: 'table',
    column_id,
    column_params
  }
}

/**
 * Checks if a column can be used as a FROM table for optimization
 * CTE-based columns (with `with` property) are eligible if they're whitelisted
 * Table-based columns are eligible if they have `get_table_conditions`
 * @param {Object} column_definition - Column definition object
 * @param {string} column_id - Column identifier
 * @returns {boolean} True if column can be used as FROM table
 */
const can_use_as_from_table = (column_definition, column_id) => {
  // CTE-based columns - maintain whitelist for backward compatibility
  if (column_definition.with) {
    const cte_whitelisted_columns = new Set([
      'player_fantasy_points_from_plays'
    ])
    return cte_whitelisted_columns.has(column_id)
  }
  // Table-based columns - require get_table_conditions for optimization
  return Boolean(column_definition.get_table_conditions)
}

/**
 * Determines the final from table to use for the query
 * @param {Object} params - Parameters object
 * @param {Array} params.sort - Sort configuration
 * @param {Array} params.columns - Column configurations
 * @param {Array} params.prefix_columns - Prefix column configurations
 * @param {Array} params.splits - Active split dimensions
 * @param {Object} params.data_views_column_definitions - Column definition registry
 * @returns {Object} Final from table configuration
 */
const get_from_table_config = ({
  sort,
  columns,
  prefix_columns,
  splits,
  subjects = ['player'],
  data_views_column_definitions
}) => {
  const subject_id = subjects[0]
  const sort_based_from_table = determine_from_table({
    sort,
    columns,
    prefix_columns,
    splits,
    data_views_column_definitions
  })

  // Only use sort-based from table for columns that support optimization
  if (
    sort_based_from_table.from_table_name &&
    sort_based_from_table.column_id
  ) {
    const column_definition =
      data_views_column_definitions[sort_based_from_table.column_id]

    // Reject the sort-based FROM optimization when the sort column will be
    // routed through apply_output_aggregator (params.output set, after
    // normalize-output-param translation, + supports_output on the def).
    // Otherwise the legacy `with` hook materializes the same source data as
    // the FROM table while the aggregator-rate CTE materializes it again
    // for the value -- the orphan-CTE gate cannot suppress the legacy CTE
    // when it is the FROM source.
    const aggregator_handled = Boolean(
      sort_based_from_table.column_params?.output &&
        column_definition?.supports_output
    )

    if (
      column_definition &&
      !aggregator_handled &&
      can_use_as_from_table(column_definition, sort_based_from_table.column_id)
    ) {
      const granularity = column_definition.granularity || []
      const identity_compatible = granularity.some(
        (identity_id) => get_identity(identity_id).subject === subject_id
      )

      if (identity_compatible) {
        // Use sort-based from table if available and no splits are configured
        // or if it supports all required splits
        if (splits.length === 0) {
          return sort_based_from_table
        }

        const granularity_splits =
          derive_supported_splits_from_granularity(granularity)
        const supports_all_splits = splits.every((split) =>
          granularity_splits.includes(split)
        )

        if (supports_all_splits) {
          return sort_based_from_table
        }
      }
    }
  }

  // Fall back to the subject's canonical FROM table -- the identity's
  // canonical from_source.table for the active subject + splits.
  if (subject_id === 'team') {
    if (splits.includes('week')) {
      return { from_table_name: 'team_years_weeks', from_table_type: 'table' }
    }
    if (splits.includes('year')) {
      return { from_table_name: 'team_years', from_table_type: 'table' }
    }
    return { from_table_name: 'team', from_table_type: 'table' }
  }
  return {
    from_table_name: 'player',
    from_table_type: 'table'
  }
}

/**
 * Sets up the from table and player joins for the query
 * @param {Object} params - Parameters object
 * @param {Object} params.players_query - The Knex query builder instance
 * @param {Object} params.from_table_config - From table configuration
 * @param {Object} params.data_views_column_definitions - Column definition registry
 * @param {Array} params.splits - Active split dimensions
 * @returns {void}
 */
const setup_from_table_and_player_joins = ({
  players_query,
  from_table_config,
  data_views_column_definitions,
  splits = [],
  query_context
}) => {
  const { from_table_name, from_table_type, column_id, column_params } =
    from_table_config

  log(`Setting up from table: ${from_table_name} (type: ${from_table_type})`)

  const subject_id = query_context.subject_id

  // Team-identity FROM-source dispatch: register the team identity's CTEs
  // (team VALUES, team_years, team_years_weeks per active splits), FROM the
  // identity's canonical table, SELECT team_code instead of pid, skip the
  // player inner join.
  if (subject_id === 'team') {
    const identity = get_identity(query_context.identity_id)
    const from_source = identity.from_source({
      year_range: query_context.year_range
    })
    for (const { name, sql } of from_source.with) {
      if (query_context.registered_ctes.has(name)) continue
      players_query.with(name, db.raw(sql))
      query_context.registered_ctes.add(name)
    }
    players_query.from(from_source.table)
    players_query.select(`${from_source.table}.team_code`)
    log(`Set up team-identity from table: ${from_source.table}`)
    return
  }

  // For 'table' type, get the actual table name and set up alias if needed
  let actual_table_name = from_table_name
  let column_definition = null
  if (from_table_type === 'table' && column_id) {
    column_definition = data_views_column_definitions[column_id]
    actual_table_name =
      column_definition?.table_name ||
      column_definition?.source?.table ||
      from_table_name
  }

  // Set up the from table with alias if needed
  const table_reference =
    actual_table_name === from_table_name
      ? actual_table_name
      : `${actual_table_name} as ${from_table_name}`

  players_query.from(table_reference)
  players_query.select(`${from_table_name}.pid`)

  // Join to player table if the from table is not 'player'
  if (from_table_name !== 'player') {
    players_query.innerJoin('player', 'player.pid', `${from_table_name}.pid`)
  }

  // Apply get_table_conditions as WHERE clauses when table is used as FROM
  if (column_definition && column_definition.get_table_conditions) {
    const conditions = column_definition.get_table_conditions({
      params: column_params || {},
      splits
    })
    for (const condition of conditions) {
      // Validate column name to prevent SQL injection
      if (!/^[a-z_][a-z0-9_]*$/i.test(condition.column)) {
        throw new Error(`Invalid column name: ${condition.column}`)
      }
      players_query.where(
        `${from_table_name}.${condition.column}`,
        condition.value
      )
    }
  }

  // Join split-identity bridges only when from table is 'player'; non-player
  // from-tables rely on their own year/week columns (legacy reference
  // heuristic still active until checkpoint (d) drops it).
  if (from_table_name === 'player') {
    if (!query_context.joined_split_bridges)
      query_context.joined_split_bridges = new Set()
    if (
      splits.includes('year') &&
      !query_context.joined_split_bridges.has('player->player_year')
    ) {
      const player_year_bridge = resolve_bridge('player', 'player_year')
      player_year_bridge.join_cte({ query_context })
      query_context.joined_split_bridges.add('player->player_year')
    }
    if (
      splits.includes('week') &&
      !query_context.joined_split_bridges.has('player_year->player_year_week')
    ) {
      const player_year_week_bridge = resolve_bridge(
        'player_year',
        'player_year_week'
      )
      player_year_week_bridge.join_cte({ query_context })
      query_context.joined_split_bridges.add('player_year->player_year_week')
    }
  }

  log(
    `Set up from table: ${actual_table_name}${actual_table_name !== from_table_name ? ` as ${from_table_name}` : ''}`
  )
}

const is_year_offset_range = (params) =>
  params.year_offset &&
  Array.isArray(params.year_offset) &&
  params.year_offset.length > 1 &&
  params.year_offset[0] !== params.year_offset[1]

const get_table_name = ({ column_definition, column_params, splits }) => {
  if (column_definition.table_alias) {
    return column_definition.table_alias({ params: column_params, splits })
  }
  return column_definition.table_name || column_definition.source?.table
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
  rate_type_column_mapping = {},
  output_select_mapping = {},
  data_view_options,
  data_view_metadata
}) => {
  const column_ids = []
  const with_select_strings = []
  const select_strings = []
  const group_by_strings = []

  const make_source_join_func = (column_definition, column_id) => ({
    query,
    params,
    join_type,
    splits: arg_splits
  }) =>
    attach_source({
      players_query: query,
      query_context: data_view_options.query_context,
      column_def: { ...column_definition, column_id },
      params,
      table_alias: table_name,
      join_type,
      splits: arg_splits ?? splits
    })

  // the pid column and join_func should be the same among column definitions with the same table name/alias
  let pid_columns = null
  let join_func = null
  let with_func = null

  // Columns whose output was already produced by apply_output_aggregator
  // (entry in output_select_mapping) must skip legacy with/join attribution,
  // otherwise the aggregator CTE is built AND an orphaned legacy CTE is
  // materialized + LEFT JOINed for the same column -- redundant work that
  // measurably regresses query latency (see plan: post-Phase-B timeout
  // investigation 2026-05-15). Post Unit 2(b), get_from_table_config rejects
  // aggregator-handled columns as the FROM source, so the prior
  // !table_is_from_table guard is no longer reachable.
  const is_aggregator_handled = (column_id, column_index) =>
    Boolean(output_select_mapping[`${column_id}_${column_index}`])

  // When every column at this table_name group is aggregator-handled, skip
  // the legacy fallback LEFT JOIN at the bottom of this function -- the
  // aggregator already added its own CTEs and joins. Without this gate, the
  // fallback joins an unused (and possibly absent) legacy CTE.
  let any_legacy_column = false

  // Column ids with at least one legacy (non-aggregator-handled) instance.
  // The legacy team-stats wrapper SUMs `inner.<column_name>` for each entry,
  // but the inner CTE only selects expressions for legacy instances. Building
  // the wrapper from `unique_column_ids` (which includes aggregator-handled
  // ids) emits `sum(inner.col)` for columns the inner CTE no longer has,
  // raising `column ... does not exist` at execution.
  const legacy_column_ids = new Set()

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
      output_select_mapping,
      splits,
      data_view_options
    })

    select_strings.push(...main_select_result.select)
    group_by_strings.push(...main_select_result.group_by)

    if (is_aggregator_handled(column_id, column_index)) {
      column_ids.push(column_id)
      continue
    }

    any_legacy_column = true
    legacy_column_ids.add(column_id)

    if (
      column_definition.source &&
      (column_definition.source.table || column_definition.source.attach)
    ) {
      join_func = make_source_join_func(column_definition, column_id)
    } else if (column_definition.join) {
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
        splits,
        data_view_options
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

    const where_handled_by_aggregator = is_aggregator_handled(
      where_clause.column_id,
      0
    )

    if (!where_handled_by_aggregator) {
      any_legacy_column = true
    }

    if (
      !where_handled_by_aggregator &&
      column_definition.source &&
      (column_definition.source.table || column_definition.source.attach)
    ) {
      join_func = make_source_join_func(column_definition, where_clause.column_id)
    } else if (!where_handled_by_aggregator && column_definition.join) {
      join_func = column_definition.join
    }

    if (!where_handled_by_aggregator && column_definition.with) {
      with_func = column_definition.with
      pid_columns = column_definition.pid_columns
      legacy_column_ids.add(where_clause.column_id)

      const with_filter_string = get_with_where_string({
        where_clause,
        column_definition,
        table_name,
        column_index: 0,
        params: where_clause.params,
        rate_type_column_mapping,
        splits,
        data_view_options
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
          splits,
          data_view_options
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
      output_select_mapping,
      splits,
      data_view_options
    })

    // Route to HAVING when the column already exposes the value as a
    // main-SELECT alias -- either via legacy `use_having` or because the
    // output-aggregator path emitted `${column_name}_${column_index}` in
    // the main SELECT.
    const has_output_alias = Boolean(
      output_select_mapping[`${where_clause.column_id}_0`]
    )

    if (main_where_string) {
      if (column_definition.use_having || has_output_alias) {
        main_having_clause_strings.push(main_where_string)
      } else {
        main_where_clause_strings.push(main_where_string)
      }

      if (
        !has_output_alias &&
        column_definition.main_where_group_by
      ) {
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
    for (const column_id of legacy_column_ids) {
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
      if (select_string?.sql) {
        players_query.select(
          db.raw(select_string.sql, select_string.bindings || [])
        )
      } else {
        players_query.select(db.raw(select_string))
      }
    }
    for (const group_by_string of group_by_strings) {
      players_query.groupBy(db.raw(group_by_string))
    }
  } else {
    for (const select_string of select_strings) {
      if (select_string?.sql) {
        players_query.select(
          db.raw(select_string.sql, select_string.bindings || [])
        )
      } else {
        players_query.select(db.raw(select_string))
      }
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
  // Skip join entirely if this table is the same as the from table (prevents self-join)
  const skip_join_for_offset_range =
    is_year_offset_range(group_column_params) && !where_clauses.length
  if (table_name !== data_view_options.from_table_name) {
    if (join_func && !skip_join_for_offset_range) {
      await join_func({
        query: players_query,
        table_name,
        params: group_column_params,
        join_type: where_clauses.length ? 'INNER' : 'LEFT',
        splits,
        data_view_options
      })
    } else if (
      !skip_join_for_offset_range &&
      any_legacy_column &&
      table_name !== 'player' &&
      table_name !== 'nfl_plays' &&
      (select_strings.length ||
        main_where_clause_strings.length ||
        main_having_clause_strings.length)
    ) {
      players_query.leftJoin(table_name, `${table_name}.pid`, 'player.pid')
    }
  } else {
    log(
      `Skipping self-join for table: ${table_name} (from table: ${data_view_options.from_table_name})`
    )
  }
}

const get_grouped_clauses_by_table = ({
  where: where_clauses,
  table_columns,
  data_views_column_definitions,
  splits
}) => {
  const grouped_clauses_by_table = {}
  const tables_seeded_by_column = new Set()

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
        granularity: column_definition.granularity || []
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
        granularity: column_definition.granularity || []
      }
      tables_seeded_by_column.add(table_name)
    } else if (!tables_seeded_by_column.has(table_name)) {
      // The group was seeded by a WHERE clause. Override group_column_params
      // with the column's params so the display join reflects column intent
      // rather than the (often narrower) WHERE filter scope.
      grouped_clauses_by_table[table_name].group_column_params = column_params
      tables_seeded_by_column.add(table_name)
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
    const supported_splits = derive_supported_splits_from_granularity(
      table_info.granularity
    )
    const supported_splits_key = supported_splits
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
  limit = 500,
  subjects = ['player']
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

  // filter where and remove any where clauses that have a value of null, undefined, empty string, or empty array
  where = where.filter((where_clause) => {
    if (
      where_clause.operator === 'IS NULL' ||
      where_clause.operator === 'IS NOT NULL'
    ) {
      return true
    }

    if (
      where_clause.value === null ||
      where_clause.value === undefined ||
      where_clause.value === ''
    ) {
      return false
    }

    if (Array.isArray(where_clause.value) && where_clause.value.length === 0) {
      return false
    }

    return true
  })

  // backwards compatibility for rate_type, column params
  // process params and convert dynamic params to static
  where = where.map(process_item_params)
  columns = columns.map(process_item_params)
  prefix_columns = prefix_columns.map(process_item_params)
  sort = sort.map(process_item_params)

  columns = normalize_columns({ columns, splits })
  prefix_columns = normalize_columns({ columns: prefix_columns, splits })
  where = normalize_columns({ columns: where, splits })

  // Determine primary table first to optimize query structure
  const from_table_config = get_from_table_config({
    sort,
    columns,
    prefix_columns,
    splits,
    subjects,
    data_views_column_definitions
  })

  // Initialize query without from table - will be set up later
  const players_query = db.queryBuilder()

  const table_columns = []
  const rate_type_column_mapping = {}
  const output_select_mapping = {}
  const data_view_options = {
    opening_days_joined: false,
    player_seasonlogs_joined: false,
    nfl_year_week_timestamp_joined: false,
    from_table_name: from_table_config.from_table_name,
    from_table_type: from_table_config.from_table_type,
    from_table_column_id: from_table_config.column_id,
    year_coalesce_args: [],
    matchup_opponent_types: new Set(),
    year_range: []
  }

  // year_range is mutated below once the split branch computes it -- every
  // reader (bridge add_cte, output aggregator) runs later during column
  // processing.
  const query_context = build_query_context({
    subjects,
    splits,
    year_range: [],
    params: {},
    db,
    players_query
  })
  data_view_options.query_context = query_context
  query_context.data_view_options = data_view_options
  const data_view_metadata = {
    created_at: Date.now(),
    cache_ttl: 1000 * 60 * 60 * 24 * 7, // 1 week
    cache_expire_at: null
  }

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

  // matchup_opponent_type joins reference player.current_nfl_team; skip
  // entirely when the query is team-identity.
  const is_matchup_player_identity_active = () =>
    query_context.identity_id.startsWith('player')
  for (const opponent_type of data_view_options.matchup_opponent_types) {
    if (!is_matchup_player_identity_active()) {
      continue
    }
    switch (opponent_type) {
      case 'current_week_opponent_total':
        add_week_opponent_cte_tables({
          players_query,
          table_name: 'current_week_opponents',
          week: current_season.nfl_seas_week,
          year: current_season.year,
          seas_type: current_season.nfl_seas_type
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
          current_season.calculate_week(current_season.now.add(1, 'week'))

        add_week_opponent_cte_tables({
          players_query,
          table_name: 'next_week_opponents',
          week: next_week,
          year: current_season.year,
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
    data_view_options.year_range = year_range
    query_context.year_range = year_range

    if (query_context.subject_id === 'team') {
      const team_year_bridge = resolve_bridge('team', 'team_year')
      team_year_bridge.add_cte({ query_context })
      query_context.applied_bridges.add('team->team_year')

      if (splits.includes('week')) {
        const team_year_week_bridge = resolve_bridge(
          'team_year',
          'team_year_week'
        )
        team_year_week_bridge.add_cte({ query_context })
        query_context.applied_bridges.add('team_year->team_year_week')
      }
    } else {
      // Find position filter if it exists
      const position_filter = where.find(
        (clause) =>
          clause.column_id === 'player_position' &&
          (Array.isArray(clause.value)
            ? clause.value.length > 0
            : Boolean(clause.value))
      )

      if (position_filter) {
        const column_definition = data_views_column_definitions.player_position
        query_context.position_filter_sql = get_where_string({
          where_clause: position_filter,
          column_definition,
          table_name: 'player',
          column_index: 0,
          is_main_select: false,
          params: position_filter.params || {}
        })
      }

      const player_year_bridge = resolve_bridge('player', 'player_year')
      player_year_bridge.add_cte({ query_context })
      query_context.applied_bridges.add('player->player_year')

      if (splits.includes('week')) {
        const player_year_week_bridge = resolve_bridge(
          'player_year',
          'player_year_week'
        )
        player_year_week_bridge.add_cte({ query_context })
        query_context.applied_bridges.add('player_year->player_year_week')
      }
    }
  }

  // Set up the from table and player joins using consolidated function
  setup_from_table_and_player_joins({
    players_query,
    from_table_config,
    data_views_column_definitions,
    splits,
    query_context
  })

  // Resolve reference column expressions for the chosen FROM-table and the
  // active identity. query_context retains its identity-derived references
  // from build_query_context (bridges, output-aggregators, and other
  // identity-aware consumers read those values). data_view_options exposes
  // the FROM-table-aware view for legacy consumers (select-string,
  // data-view-join-function, add-player-year-teams-cte, rate-type plugins)
  // that still join measures via the from-table's own pid/year/week columns.
  const references = resolve_references({
    identity_id: query_context.identity_id,
    from_table_name: data_view_options.from_table_name
  })
  data_view_options.pid_reference = references.pid_reference
  data_view_options.team_reference = references.team_reference
  data_view_options.year_reference = references.year_reference
  data_view_options.week_reference = references.week_reference
  query_context.data_view_options = data_view_options

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

  // Output-aggregator dispatch. Every column with `params.output` (either
  // native or translated from legacy `params.rate_type` by
  // normalize-output-param) and `supports_output` on its column-def routes
  // through apply_output_aggregator, which materializes the CTE(s), joins
  // them, and emits the outer SELECT into `output_select_mapping`. The
  // legacy `rate_type_tables` / `rate_type_column_mapping` dispatch loop
  // was retired here.
  for (const [index, column] of [
    ...prefix_columns,
    ...columns,
    ...where
  ].entries()) {
    if (
      typeof column !== 'object' ||
      !column.params ||
      !column.params.output
    ) {
      continue
    }
    const column_definition = data_views_column_definitions[column.column_id]
    if (!column_definition || !column_definition.supports_output) {
      continue
    }
    const column_index = get_column_index({
      column_id: column.column_id,
      index,
      columns: table_columns
    })
    const identity_id = is_team_column_definition(column_definition)
      ? 'team_year'
      : 'player_year'
    const column_def = { ...column_definition, column_id: column.column_id }
    const result = await apply_output_aggregator({
      query_context,
      column_def,
      params: column.params,
      identity_id,
      column_index
    })
    output_select_mapping[`${column.column_id}_${column_index}`] = result
  }

  // Materialize all coalesced output-aggregator CTEs. Deferred until after
  // the per-column dispatch loop so multiple measures sharing a scan key
  // (same source / period / identity / predicate / apply_filters) land in
  // one materialized CTE with N `SUM(...) AS m_<hash>` columns instead of
  // N separate single-SUM CTEs each rescanning the source table.
  flush_measure_batches({ query_context, build_batched_period_cte })

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
      await add_clauses_for_table({
        players_query,
        select_columns,
        where_clauses,
        table_name,
        group_column_params,
        splits: available_splits,
        rate_type_column_mapping,
        output_select_mapping,
        data_view_options,
        data_view_metadata
      })

      if (available_splits.includes('year')) {
        if (
          select_columns.length &&
          !is_year_offset_range(group_column_params)
        ) {
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
      }
    }
  }

  // Add a select and group by for each split using centralized references
  for (const split of splits) {
    if (split === 'year') {
      players_query.select(data_view_options.year_reference)
      players_query.groupBy(data_view_options.year_reference)
    }

    if (split === 'week') {
      players_query.select(data_view_options.week_reference)
      players_query.groupBy(data_view_options.week_reference)
    }
  }

  for (const sort_clause of sort) {
    const column = find_sort_column({
      column_id: sort_clause.column_id,
      column_index: sort_clause.column_index,
      columns: table_columns
    })

    // Add a check to ensure column is not null. Stale saved-view sorts can
    // reference column_ids that are not in the current selected columns
    // (typical pattern: URL retains a sort after the user removed the
    // sorted column from the view). The sort is correctly skipped; demoted
    // from console.warn to the data-views debug channel so replay capture
    // and production logs stay quiet.
    if (!column) {
      log(
        `Sort column not found for column_id: ${sort_clause.column_id} (column_index=${sort_clause.column_index})`
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

  if (query_context.subject_id === 'team') {
    players_query.orderBy(data_view_options.team_reference, 'asc')
    players_query.groupBy(data_view_options.team_reference)
  } else {
    players_query.orderBy(data_view_options.pid_reference, 'asc')
    players_query.select('player.pos')
    players_query.groupBy(
      data_view_options.pid_reference,
      'player.lname',
      'player.fname',
      'player.pos'
    )
  }

  if (offset) {
    players_query.offset(offset)
  }
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
  calculate_total_count = true,
  subjects = ['player']
} = {}) {
  const { query, data_view_metadata } = await get_data_view_results_query({
    splits,
    where,
    columns,
    prefix_columns,
    sort,
    offset,
    limit,
    subjects
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
      // Execute count query with timeout and elevated work_mem for complex aggregations
      const count_session_settings = `SET LOCAL statement_timeout = ${timeout}; SET LOCAL work_mem = '1GB'; SET LOCAL jit = off;`
      const full_count_query = `${count_session_settings} ${count_wrapper_query.toString()};`
      const count_response = await db.raw(full_count_query)
      total_count = parseInt(count_response[3].rows[0].total_count, 10)
    } else {
      // Execute count query with elevated work_mem
      const full_count_query = `SET LOCAL work_mem = '1GB'; SET LOCAL jit = off; ${count_wrapper_query.toString()};`
      const count_response = await db.raw(full_count_query)
      total_count = parseInt(count_response[2].rows[0].total_count, 10)
    }
  }

  if (timeout) {
    const query_string = query.toString()
    const session_settings = `SET LOCAL statement_timeout = ${timeout}; SET LOCAL work_mem = '1GB'; SET LOCAL jit = off;`
    const full_query = `${session_settings} ${query_string};`

    const response = await db.raw(full_query)
    const data_view_results = response[3].rows

    return {
      data_view_results,
      data_view_metadata: {
        ...data_view_metadata,
        ...(total_count !== null ? { total_count } : {})
      },
      data_view_query_string
    }
  }

  const query_string = query.toString()
  const full_query = `SET LOCAL work_mem = '1GB'; SET LOCAL jit = off; ${query_string};`
  const response = await db.raw(full_query)
  const data_view_results = response[2].rows

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
