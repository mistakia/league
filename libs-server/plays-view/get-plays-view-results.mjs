import db from '#db'
import debug from 'debug'
import { current_season } from '#constants'
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
  player_passer: ['nfl_plays.passer_pid'],
  player_rusher: ['nfl_plays.ball_carrier_pid'],
  player_target: ['nfl_plays.target_pid'],
  team: ['nfl_plays.possession_nfl_team'],
  game: []
}

const CACHE_TTL_CURRENT_SEASON = 60 * 60 // 1 hour (seconds)
const CACHE_TTL_HISTORICAL = 7 * 24 * 60 * 60 // 7 days (seconds)

// Read off the resolved WHERE clauses rather than a param, because the plays
// view has no params. apply_default_season_scope guarantees a play_year clause
// exists by the time this runs, so there is no no-year branch to get wrong.
function get_cache_info({ where }) {
  const year_clause = where.find((clause) => clause.column_id === 'play_year')
  const value = year_clause ? year_clause.value : null
  const years = Array.isArray(value) ? value : [value]
  const includes_current_season = years.some(
    (y) => Number(y) === current_season.year
  )
  const cache_ttl = includes_current_season
    ? CACHE_TTL_CURRENT_SEASON
    : CACHE_TTL_HISTORICAL
  return { cache_ttl }
}

// Persisted short URLs carry columns in both the bare-string and the
// {column_id, params} object form, so both shapes are still ACCEPTED. The
// params are deliberately not read: no plays column has ever consumed one, and
// a filter that silently does nothing is worse than no filter at all.
function resolve_column_id(column) {
  return typeof column === 'string' ? column : column.column_id
}

// The plays view takes no params. Every filterable fact about a play is a
// column and `where` is the only filter mechanism, so the default scope is
// expressed as ordinary WHERE clauses -- visible in the emitted SQL, and
// editable by the caller like any other filter.
//
// Two rules, and the asymmetry between them is the point.
//
// A year is ALWAYS synthesized when absent, because it is the only thing
// standing between an unscoped request and a full scan of every nfl_plays
// partition (1.5M rows).
//
// The regular-season default is synthesized ONLY when the request names no
// season scope at all. A caller who names a year gets exactly the seasons they
// named. The old params-coupled default got this backwards: a play_year clause
// suppressed the year param, the REG default rode on that param, and so a view
// that scoped its own seasons silently lost its season-type filter and mixed
// in preseason.
function apply_default_season_scope(where) {
  const has_year = where.some((clause) => clause.column_id === 'play_year')
  if (has_year) {
    return where
  }

  const has_seas_type = where.some(
    (clause) => clause.column_id === 'play_seas_type'
  )
  const defaults = [
    {
      column_id: 'play_year',
      operator: '=',
      value: current_season.last_completed_season_year
    }
  ]
  if (!has_seas_type) {
    defaults.push({
      column_id: 'play_seas_type',
      operator: '=',
      value: 'REG'
    })
  }

  return [...where, ...defaults]
}

function get_plays_view_hash({
  columns = [],
  prefix_columns = [],
  where = [],
  sort = [],
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
  where: requested_where = [],
  sort = [],
  group_by = null,
  offset = 0,
  limit = 500
}) {
  const where = apply_default_season_scope(requested_where)

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

  // Build base query. Season scope reaches the query through the WHERE loop
  // below like every other filter -- there is no separate scope application
  // and no param layer.
  const query = db('nfl_plays')

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
    all_column_ids.add(resolve_column_id(col))
  }

  // Process main columns
  for (const col of columns) {
    all_column_ids.add(resolve_column_id(col))
  }

  // Process where columns
  for (const clause of where) {
    all_column_ids.add(resolve_column_id(clause))
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

  for (const column_id of visible_columns) {
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
        const agg_select = column_def.aggregate_select()
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
        const main_selects = column_def.main_select()
        select_columns.push(...main_selects)
      }
    }
  }

  // Apply WHERE clauses from column-specific filters
  for (const clause of where) {
    const column_def = plays_view_column_definitions[clause.column_id]
    // Ensure joins are applied for where columns
    if (column_def.join) {
      column_def.join({ query, join_state, group_by })
    }
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
        'nfl_games.home_nfl_team',
        'nfl_games.away_nfl_team'
      )
      query.groupBy(
        'nfl_plays.esbid',
        'nfl_games.week',
        'nfl_games.home_nfl_team',
        'nfl_games.away_nfl_team'
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
      // Ensure joins are applied for sort columns
      if (column_def.join) {
        column_def.join({ query, join_state, group_by })
      }
      const sort_column =
        column_def.sort_column_name ||
        (column_def.table_name && column_def.column_name
          ? `${column_def.table_name}.${column_def.column_name}`
          : column_def.column_name || sort_item.column_id)
      const sort_direction = sort_item.desc ? 'desc' : 'asc'
      query.orderByRaw(`${sort_column} ${sort_direction} NULLS LAST`)
    }
  }

  // Build count query before pagination is applied
  const count_query = query.clone()

  // Apply pagination
  query.offset(offset).limit(Math.min(limit, 2000))

  // Build metadata
  const { cache_ttl } = get_cache_info({ where })
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
    const count_builder = group_by
      ? db
          .count('* as count')
          .from(cleaned_count_query.select(db.raw('1')).as('subquery'))
      : cleaned_count_query.count('* as count')

    if (timeout) {
      count_builder.timeout(timeout)
    }

    count_promise = count_builder
      .first()
      .then((result) => (result ? Number(result.count) : 0))
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
