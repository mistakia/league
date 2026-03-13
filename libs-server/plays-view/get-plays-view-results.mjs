import db from '#db'
import debug from 'debug'
import { current_season } from '#constants'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import * as validators from '#libs-server/validators.mjs'
import plays_view_column_definitions from '#libs-server/plays-view/column-definitions/index.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'

const log = debug('plays-view')

const VALID_GROUP_BY_VALUES = new Set([
  'overall',
  'player_passer',
  'player_rusher',
  'player_target',
  'team',
  'game'
])

const GROUP_BY_COLUMNS = {
  overall: [],
  player_passer: ['nfl_plays.psr_pid'],
  player_rusher: ['nfl_plays.bc_pid'],
  player_target: ['nfl_plays.trg_pid'],
  team: ['nfl_plays.pos_team'],
  game: []
}

const CACHE_TTL_CURRENT_SEASON = 60 * 60 // 1 hour (seconds)
const CACHE_TTL_HISTORICAL = 7 * 24 * 60 * 60 // 7 days (seconds)

function get_cache_info({ params = {} }) {
  const year = params.year
  const years = Array.isArray(year) ? year : [year]
  const includes_current_season = years.some(
    (y) => Number(y) === current_season.year
  )
  const cache_ttl = includes_current_season
    ? CACHE_TTL_CURRENT_SEASON
    : CACHE_TTL_HISTORICAL
  return { cache_ttl }
}

function resolve_column_id(column) {
  if (typeof column === 'string') {
    return { column_id: column, params: {} }
  }
  return { column_id: column.column_id, params: column.params || {} }
}

function get_plays_view_hash({
  columns = [],
  prefix_columns = [],
  where = [],
  sort = [],
  params = {},
  group_by = null,
  offset = 0,
  limit = 500
}) {
  return get_table_hash(
    JSON.stringify({
      columns,
      prefix_columns,
      where,
      sort,
      params,
      group_by,
      offset,
      limit
    })
  )
}

export { get_plays_view_hash }

export async function get_plays_view_results_query({
  columns = [],
  prefix_columns = [],
  where = [],
  sort = [],
  params = {},
  group_by = null,
  offset = 0,
  limit = 500
}) {
  // Validate inputs
  const table_state_valid = validators.table_state_validator({
    columns,
    where,
    sort,
    offset,
    limit
  })
  if (table_state_valid !== true) {
    throw new Error(`Invalid table state: ${JSON.stringify(table_state_valid)}`)
  }

  if (group_by !== null && !VALID_GROUP_BY_VALUES.has(group_by)) {
    throw new Error(`Invalid group_by value: ${group_by}`)
  }

  // Default year to current season, unless play_year is in WHERE clauses
  const query_params = { ...params }
  const has_year_in_where = where.some((c) => c.column_id === 'play_year')
  if (!query_params.year && !has_year_in_where) {
    query_params.year = [current_season.stats_season_year]
  }

  // Build base query
  const query = db('nfl_plays')

  // Apply global params via apply_play_by_play_column_params_to_query
  apply_play_by_play_column_params_to_query({
    query,
    params: query_params,
    table_name: 'nfl_plays'
  })

  // Track which joins have been added
  const join_state = {
    player_passer: false,
    player_rusher: false,
    player_target: false,
    nfl_games: false
  }

  // Resolve all columns (prefix + main + where + sort)
  const all_column_ids = new Set()
  const select_columns = []

  // Process prefix columns
  for (const col of prefix_columns) {
    const { column_id } = resolve_column_id(col)
    all_column_ids.add(column_id)
  }

  // Process main columns
  for (const col of columns) {
    const { column_id } = resolve_column_id(col)
    all_column_ids.add(column_id)
  }

  // Process where columns
  for (const clause of where) {
    const { column_id } = resolve_column_id(clause)
    all_column_ids.add(column_id)
  }

  // Process sort columns
  for (const sort_item of sort) {
    all_column_ids.add(sort_item.column_id)
  }

  // Validate all column_ids exist
  for (const column_id of all_column_ids) {
    if (!plays_view_column_definitions[column_id]) {
      throw new Error(`Unknown column: ${column_id}`)
    }
  }

  // Apply joins and selects for requested columns
  const visible_columns = [...prefix_columns, ...columns].map(resolve_column_id)

  for (const { column_id } of visible_columns) {
    const column_def = plays_view_column_definitions[column_id]

    // Add joins if needed
    if (column_def.join) {
      column_def.join({ query, join_state, group_by })
    }

    // Add select expressions
    if (group_by) {
      // In aggregate mode, check if this column should be included
      if (
        column_def.player_group_by &&
        column_def.player_group_by !== group_by
      ) {
        // Skip player name columns when group_by doesn't match the player role
        continue
      }
      if (column_def.aggregate_select) {
        const agg_select = column_def.aggregate_select({ params: query_params })
        if (agg_select) {
          select_columns.push(agg_select)
        }
      } else if (column_def.group_by_select) {
        // Columns that are part of the GROUP BY (e.g., team, game)
        const group_select = column_def.group_by_select({ group_by })
        if (group_select) {
          select_columns.push(group_select)
        }
      }
    } else {
      // Browse mode - direct field selects
      if (column_def.main_select) {
        const main_selects = column_def.main_select({ params: query_params })
        select_columns.push(...main_selects)
      }
    }
  }

  // Apply WHERE clauses from column-specific filters
  for (const clause of where) {
    const column_def = plays_view_column_definitions[clause.column_id]
    if (column_def.main_where) {
      const where_expr = column_def.main_where({
        query,
        clause,
        join_state,
        group_by
      })
      if (where_expr) {
        apply_where_clause({ query, clause, where_expr, group_by, column_def })
      }
    }
  }

  // Apply GROUP BY
  if (group_by) {
    const group_by_columns = GROUP_BY_COLUMNS[group_by] || []
    if (group_by_columns.length) {
      query.groupBy(group_by_columns)
    }

    // Add group_by prefix columns for game mode
    if (group_by === 'game') {
      // Auto-include week, home team, away team from nfl_games
      if (!join_state.nfl_games) {
        query.leftJoin('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
        join_state.nfl_games = true
      }
      select_columns.unshift(
        'nfl_plays.esbid',
        'nfl_games.week',
        'nfl_games.h',
        'nfl_games.v'
      )
      query.groupBy(
        'nfl_plays.esbid',
        'nfl_games.week',
        'nfl_games.h',
        'nfl_games.v'
      )
    }

    // Add play count in aggregate mode
    select_columns.push(db.raw('COUNT(*) as play_count'))
  }

  // Apply select
  if (select_columns.length) {
    query.select(select_columns)
  } else {
    query.select('nfl_plays.*')
  }

  // Apply sorting
  for (const sort_item of sort) {
    const column_def = plays_view_column_definitions[sort_item.column_id]
    if (column_def) {
      const sort_column =
        column_def.sort_column_name ||
        column_def.column_name ||
        sort_item.column_id
      const sort_direction = sort_item.desc ? 'desc' : 'asc'
      query.orderByRaw(`${sort_column} ${sort_direction} NULLS LAST`)
    }
  }

  // Build count query before pagination is applied
  const count_query = query.clone()

  // Apply pagination
  query.offset(offset).limit(Math.min(limit, 2000))

  // Build metadata
  const { cache_ttl } = get_cache_info({ params: query_params })
  const plays_view_metadata = {
    cache_ttl
  }

  return { query, count_query, plays_view_metadata }
}

export default async function get_plays_view_results({
  columns = [],
  prefix_columns = [],
  where = [],
  sort = [],
  params = {},
  group_by = null,
  offset = 0,
  limit = 500,
  timeout,
  calculate_total_count = false
}) {
  const { query, count_query, plays_view_metadata } =
    await get_plays_view_results_query({
      columns,
      prefix_columns,
      where,
      sort,
      params,
      group_by,
      offset,
      limit
    })

  // Apply timeout
  if (timeout) {
    query.timeout(timeout)
  }

  log('Executing plays view query')

  // Build count promise if needed
  let count_promise = Promise.resolve(null)
  if (calculate_total_count) {
    const cleaned_count_query = count_query.clearSelect().clearOrder()
    if (group_by) {
      count_promise = db
        .count('* as count')
        .from(cleaned_count_query.select(db.raw('1')).as('subquery'))
        .first()
        .then((result) => (result ? Number(result.count) : 0))
    } else {
      count_promise = cleaned_count_query
        .count('* as count')
        .first()
        .then((result) => (result ? Number(result.count) : 0))
    }
  }

  // Execute data query and count query in parallel
  const [plays_view_results, total_count] = await Promise.all([
    query,
    count_promise
  ])

  plays_view_metadata.total_count = total_count

  return { plays_view_results, plays_view_metadata }
}

const SIMPLE_OPERATORS = new Set(['=', '!=', '>', '>=', '<', '<='])
const LIKE_OPERATORS = new Set(['ILIKE', 'NOT ILIKE', 'LIKE', 'NOT LIKE'])
const NULL_OPERATORS = new Set(['IS NULL', 'IS NOT NULL'])

function apply_where_clause({
  query,
  clause,
  where_expr,
  group_by,
  column_def
}) {
  const { operator, value } = clause
  const use_having = group_by && column_def.use_having
  const apply_raw = use_having
    ? (sql, bindings) => query.havingRaw(sql, bindings)
    : (sql, bindings) => query.whereRaw(sql, bindings)

  if (SIMPLE_OPERATORS.has(operator)) {
    apply_raw(`${where_expr} ${operator} ?`, [value])
  } else if (LIKE_OPERATORS.has(operator)) {
    apply_raw(`${where_expr} ${operator} ?`, [`%${value}%`])
  } else if (NULL_OPERATORS.has(operator)) {
    apply_raw(`${where_expr} ${operator}`)
  } else if (operator === 'IN') {
    const values = Array.isArray(value) ? value : [value]
    if (use_having) {
      apply_raw(`${where_expr} IN (${values.map(() => '?').join(',')})`, values)
    } else {
      query.whereIn(db.raw(where_expr), values)
    }
  } else if (operator === 'NOT IN') {
    const values = Array.isArray(value) ? value : [value]
    if (use_having) {
      apply_raw(
        `${where_expr} NOT IN (${values.map(() => '?').join(',')})`,
        values
      )
    } else {
      query.whereNotIn(db.raw(where_expr), values)
    }
  }
}
