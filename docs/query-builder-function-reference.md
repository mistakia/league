# Query Builder Function Reference

This document provides comprehensive documentation for every function in the data views query builder system, organized by functional area.

## Table of Contents

1. [Primary Table Optimization](#primary-table-optimization)
2. [String Generation Functions](#string-generation-functions)
3. [Caching Infrastructure](#caching-infrastructure)
4. [Hashing Functions](#hashing-functions)
5. [Join Operations](#join-operations)
6. [CTE Builders](#cte-builders)
7. [Rate Type System](#rate-type-system)
8. [Utility Functions](#utility-functions)
9. [Error Handling Patterns](#error-handling-patterns)
10. [Performance Implications](#performance-implications)

## Primary Table Optimization

### Query Initialization Functions (`get-data-view-results.mjs`)

**Note**: This section documents the new centralized reference system that replaces the deprecated `year_split_join_clause` and `week_split_join_clause` parameters. All functions now use `data_view_options` with centralized references for consistent year/week joins and player ID references.

#### `determine_from_table({ sort, columns, prefix_columns, splits, data_views_column_definitions })`

**Purpose**: Analyzes sort columns to identify the optimal starting table for query performance.

**Parameters**:

- `sort` (Array): Sort configuration from user request
- `columns` (Array): Column configurations
- `prefix_columns` (Array): Prefix column configurations
- `splits` (Array): Active split dimensions ['year', 'week']
- `data_views_column_definitions` (Object): Column definition registry

**Returns**:

```javascript
{
  from_table_name: String|null,           // Identified from table name
  from_table_type: 'default'|'table'|'cte' // Table type for join handling
}
```

**Algorithm**:

1. Examines first sort column for table information
2. Prioritizes CTE tables (typically 1-5K records) over regular tables (20K+ records)
3. Validates split compatibility with requested splits

**Example**:

```javascript
// Sort by fantasy points (CTE table)
determine_from_table({
  sort: [{ column_id: 'player_fantasy_points_from_plays', desc: true }],
  columns: [],
  prefix_columns: [],
  splits: ['year'],
  data_views_column_definitions
})
// Returns: {
//   from_table_name: 't1a2b3c4d5e6f7890',
//   from_table_type: 'cte'
// }
```

**Performance Impact**: Starting from a smaller, more selective table can reduce query execution time from 30+ seconds to under 5 seconds.

**Whitelisting System**: Currently uses a whitelist approach for gradual rollout:

```javascript
const whitelisted_columns = new Set(['player_fantasy_points_from_plays'])
```

Only whitelisted columns use the new from table optimization system. All other columns fall back to the default split-based table selection.

---

#### `setup_default_from_table(splits)`

**Purpose**: Sets up the default from table configuration based on splits when no sort-based optimization is available.

**Parameters**:

- `splits` (Array): Active split dimensions ['year', 'week']

**Returns**:

```javascript
{
  from_table_name: String,           // Default from table name
  from_table_type: String            // Table type ('table', 'cte')
}
```

**Logic**:

```javascript
// Week splits require player_years_weeks CTE
if (splits.includes('week')) {
  return { from_table_name: 'player_years_weeks', ... }
}
// Year splits require player_years CTE
else if (splits.includes('year')) {
  return { from_table_name: 'player_years', ... }
}
// No splits use base player table
else {
  return { from_table_name: 'player', ... }
}
```

---

#### `get_from_table_config({ sort, columns, prefix_columns, splits, data_views_column_definitions })`

**Purpose**: Determines the final from table to use for the query by combining sort-based optimization with split requirements.

**Parameters**:

- `sort` (Array): Sort configuration
- `columns` (Array): Column configurations
- `prefix_columns` (Array): Prefix column configurations
- `splits` (Array): Active split dimensions
- `data_views_column_definitions` (Object): Column definition registry

**Returns**: Final from table configuration object

**Decision Logic**:

1. Attempts sort-based from table optimization
2. Uses sort-based table if no splits are configured OR if table supports required splits
3. Falls back to default split-based table selection

---

#### `setup_from_table_and_player_joins({ players_query, from_table_config, data_views_column_definitions })`

**Purpose**: Sets up the from table and player joins for the query.

**Parameters**:

- `players_query` (Knex.QueryBuilder): The query builder instance
- `from_table_config` (Object): From table configuration
  - `from_table_name` (String): Name of the from table
  - `from_table_type` (String): Type ('table', 'cte')
  - `column_id` (String): Associated column ID
- `data_views_column_definitions` (Object): Column definition registry

**Logic**:

```javascript
// Set up the from table with alias if needed
const table_reference =
  actual_table_name === from_table_name
    ? actual_table_name
    : `${actual_table_name} as ${from_table_name}`

players_query.from(table_reference)
players_query.select(`${from_table_name}.pid`)

// Join to player table if the from table is not 'player'
if (from_table_name !== 'player') {
  players_query.leftJoin('player', 'player.pid', `${from_table_name}.pid`)
}
```

**Effect**: Modifies the query to use the optimal starting table and sets up necessary player joins.

---

#### `setup_central_references({ data_view_options, splits })`

**Purpose**: Sets up centralized references for player PID, year, and week based on the from table configuration.

**Parameters**:

- `data_view_options` (Object): Query options including from_table_name
- `splits` (Array): Active split dimensions

**Returns**: Updated data_view_options with centralized references

**Logic**:

```javascript
// Setup player PID reference from the from table
data_view_options.pid_reference = `${from_table_name}.pid`

// Setup year and week references - use the from table directly
data_view_options.year_reference = `${from_table_name}.year`
data_view_options.week_reference = `${from_table_name}.week`
```

**Usage**: These centralized references are used throughout the system for consistent year/week joins and player ID references, replacing the previous `year_split_join_clause` and `week_split_join_clause` parameters. The references are automatically determined based on the from table configuration.

## String Generation Functions

### SELECT String Generation (`select-string.mjs`)

#### `get_rate_type_sql(table_name, column_name, rate_type_table_name)`

**Purpose**: Generates SQL for rate type calculations with null safety.

**Parameters**:

- `table_name` (String): Source table containing the numerator
- `column_name` (String): Column to be divided (numerator)
- `rate_type_table_name` (String): CTE table containing denominator

**Returns**: SQL string for safe division

**Example Output**:

```sql
CAST(${table_name}.${column_name} AS DECIMAL) /
NULLIF(CAST(${rate_type_table_name}.rate_type_total_count AS DECIMAL), 0)
```

**Performance**: Uses `NULLIF` to prevent division by zero errors at database level.

---

#### `get_table_name({ column_definition, column_params, splits })`

**Purpose**: Determines the appropriate table name for a column based on its definition and parameters.

**Parameters**:

- `column_definition` (Object): Column configuration from definitions
- `column_params` (Object): Column-specific parameters
- `splits` (Array): Active split dimensions

**Returns**: String - Table name (may be aliased or generated)

**Logic**:

```javascript
return column_definition.table_alias
  ? column_definition.table_alias({ params: column_params, splits })
  : column_definition.table_name
```

**Usage**: Used throughout the system to determine the correct table name for joins and queries.

---

#### `find_sort_column({ column_id, column_index, columns })`

**Purpose**: Locates a specific column configuration within the columns array based on ID and index.

**Parameters**:

- `column_id` (String): Column identifier to search for
- `column_index` (Number): Index when multiple instances exist (default: 0)
- `columns` (Array): Array of column objects with { column, index } structure

**Returns**: Column object or null if not found

**Algorithm**:

```javascript
// First pass: exact match on both column_id and index
for (const item of columns) {
  if (item.column.column_id === column_id && item.index === column_index) {
    return item.column
  }
}

// Second pass: match on column_id with index 0 (fallback)
for (const item of columns) {
  if (item.column.column_id === column_id && item.index === 0) {
    return item.column
  }
}

return null
```

**Usage**: Used by `determine_from_table` to find sort columns for optimization decisions.

---

#### `get_select_string({ column_id, column_params, column_index, column_definition, table_name, rate_type_column_mapping, splits, is_main_select, data_view_options })`

**Purpose**: Core function that generates SELECT expressions with support for complex aggregations and rate calculations.

**Parameters**:

- `column_id` (String): Unique identifier for the column
- `column_params` (Object): Column-specific parameters
  - `year_offset` (Number|Array): Offset for year calculations
  - `numerator_column_id` (String): For calculated columns
  - `denominator_column_id` (String): For ratio calculations
- `column_index` (Number): Index when multiple instances of same column
- `column_definition` (Object): Column configuration from definitions
- `table_name` (String): Target table name (may be aliased)
- `rate_type_column_mapping` (Object): Maps column keys to rate type CTEs
- `splits` (Array): Active split dimensions ['year', 'week']
- `is_main_select` (Boolean): Whether for main query or CTE
- `data_view_options` (Object): Query options with centralized references
  - `pid_reference` (String): Centralized player PID reference
  - `year_reference` (String): Centralized year reference
  - `week_reference` (String): Centralized week reference

**Returns**:

```javascript
{
  select: Array<String>,  // SELECT expressions
  group_by: Array<String> // GROUP BY expressions
}
```

**Complex Features**:

- **Year Offset Ranges**: Handles `year_offset: [-2, 0]` for multi-year windows using centralized year references
- **Calculated Columns**: Supports numerator/denominator calculations
- **Rate Type Integration**: Automatically applies rate calculations
- **Split Awareness**: Adjusts SQL based on active splits
- **Centralized References**: Uses `data_view_options.year_reference` and `data_view_options.pid_reference` for consistent joins

**Error Conditions**:

- Missing column definition functions
- Invalid numerator/denominator references

---

#### `get_main_select_string(params)` / `get_with_select_string(params)`

**Purpose**: Wrapper functions that call `get_select_string` with appropriate context.

**Parameters**: Same as `get_select_string`

**Returns**: Same as `get_select_string`

**Usage**:

- `get_main_select_string` for main query SELECT
- `get_with_select_string` for CTE SELECT

### WHERE String Generation (`where-string.mjs`)

#### `get_where_string({ where_clause, column_definition, table_name, column_index, is_main_select, params, rate_type_column_mapping, splits, data_view_options })`

**Purpose**: Generates WHERE clause conditions with support for various operators and PostgreSQL array columns.

**Parameters**:

- `where_clause` (Object): Filter specification
  - `operator` (String): SQL operator
  - `value` (Any): Filter value(s)
  - `column_id` (String): Column identifier
- `column_definition` (Object): Column configuration
- `table_name` (String): Target table
- `column_index` (Number): Column instance index
- `is_main_select` (Boolean): Query context
- `params` (Object): Additional parameters
  - `case_insensitive` (Boolean): For string comparisons
- `rate_type_column_mapping` (Object): Rate type mappings
- `splits` (Array): Active splits
- `data_view_options` (Object): Query options with centralized references

**Supported Operators**:

- `IS NULL`, `IS NOT NULL`: Null checks
- `IN`, `NOT IN`: List membership (with array column support)
- `LIKE`, `ILIKE`, `NOT LIKE`, `NOT ILIKE`: Pattern matching
- `=`, `!=`, `>`, `<`, `>=`, `<=`: Comparisons

**Array Column Handling**:

```sql
-- For IN operator with array column
${table_name}.${column_name}::text[] && ARRAY[${values}]::text[]

-- For NOT IN operator with array column
NOT (${table_name}.${column_name}::text[] && ARRAY[${values}]::text[])
```

**Security Warning**: Uses string concatenation - needs parameterized query support.

---

#### `get_main_where_string(params)` / `get_with_where_string(params)`

**Purpose**: Context-specific wrappers for `get_where_string`.

**Parameters**: Same as `get_where_string`

**Returns**: SQL WHERE string

**CTE Integration**: The `get_with_where_string` function works with column definitions that provide a `with_where` function. The `with_where` returns a column expression (like `'fantasy_points_from_plays'`) that can be used for filtering within CTE contexts, enabling performance optimization through early filtering of aggregated data.

## Caching Infrastructure

### Cache Info Utilities (`cache-info-utils.mjs`)

#### Cache TTL Constants

```javascript
CACHE_TTL = {
  ONE_HOUR: 3600000, // 1 hour in ms
  TWO_HOURS: 7200000, // 2 hours
  SIX_HOURS: 21600000, // 6 hours
  TWELVE_HOURS: 43200000, // 12 hours
  ONE_DAY: 86400000, // 24 hours
  TWO_DAYS: 172800000, // 48 hours
  ONE_WEEK: 604800000, // 7 days
  THIRTY_DAYS: 2592000000 // 30 days
}
```

---

#### `create_season_cache_info({ current_season_ttl, historical_ttl, get_params, is_season_level })`

**Purpose**: Factory function creating season-aware cache strategies.

**Parameters**:

- `current_season_ttl` (Number): TTL for current season data (ms)
- `historical_ttl` (Number): TTL for past seasons (ms)
- `get_params` (Function): Extracts relevant params from column params
- `is_season_level` (Boolean): Whether data updates at season vs week level

**Returns**: Function that calculates cache info based on parameters

**Cache Logic**:

```javascript
// Current season + current week = shortest TTL
if (is_current_season && is_current_week) {
  return { cache_ttl: current_season_ttl }
}
// Historical data = longest TTL
if (!is_current_season) {
  return { cache_ttl: historical_ttl }
}
```

---

#### Specialized Cache Factories

**`create_frequent_update_cache_info()`**

- Returns: 2-hour TTL cache info
- Use case: Rapidly changing data (injuries, lineups)

**`create_betting_cache_info()`**

- Returns: 1-hour TTL cache info
- Use case: Betting markets and odds

**`create_static_cache_info(ttl = ONE_WEEK)`**

- Returns: Configurable TTL (default 1 week)
- Use case: Reference data, historical stats

**`create_immutable_cache_info()`**

- Returns: 30-day TTL cache info
- Use case: Historical game results, finalized stats

**`create_exact_year_cache_info({ years, current_season_week_ttl, current_season_ttl, historical_ttl })`**

- Purpose: Year-specific caching with granular control
- Parameters:
  - `years` (Array): Years to consider
  - `current_season_week_ttl` (Number): TTL for current week
  - `current_season_ttl` (Number): TTL for current season
  - `historical_ttl` (Number): TTL for past seasons

**`create_play_data_cache_info(current_season_week_ttl = FIVE_MINUTES)`**

- Purpose: Play-by-play data caching
- Special handling for live game updates

## Hashing Functions

### Data View Hash (`get-data-view-hash.mjs`)

#### `get_data_view_hash({ splits, where, columns, prefix_columns, sort, offset, limit })`

**Purpose**: Creates deterministic hash for cache key generation.

**Parameters**:

- `splits` (Array): Split dimensions
- `where` (Array): Filter conditions
- `columns` (Array): Selected columns
- `prefix_columns` (Array): Additional columns
- `sort` (Array): Sort configuration
- `offset` (Number): Pagination offset
- `limit` (Number): Result limit

**Returns**: Hashed string for cache identification

**Implementation**: Uses `get_table_hash(JSON.stringify(params))`

### Table Hash (`get-table-hash.mjs`)

#### `get_table_hash(key)`

**Purpose**: Creates collision-resistant table names using BLAKE2b.

**Parameters**:

- `key` (String): Input to hash

**Returns**: String like 't1a2b3c4d5e6f7890' (32 characters)

**Implementation**:

```javascript
const hash = blake2b(Buffer.from(key), null, 16)
return `t${hash.toString('hex')}`
```

**Performance**: BLAKE2b is faster than SHA-256 with similar security.

## Join Operations

### Data View Join Function (`data-view-join-function.mjs`)

#### `data_view_join_function(params)`

**Purpose**: Handles complex JOIN operations with extensive customization options and centralized reference system.

**Parameters** (extensive object with following properties):

- `query` (Knex.QueryBuilder): Active query builder
- `table_name` (String): Table to join
- `join_table_clause` (String): Custom join clause
- `join_type` (String): 'LEFT' or 'INNER'
- `splits` (Array): Active splits
- `params` (Object): Query parameters
  - `year` (Array): Years to filter
  - `week` (Array): Weeks to filter
  - `year_offset` (Number|Array): Year offset handling
- `additional_conditions` (Function): Custom join conditions
- `join_year` (Boolean): Whether to join on year
- `join_week` (Boolean): Whether to join on week
- `skip_week_split_join` (Boolean): Skip automatic week join when table lacks week column
- `join_on_team` (Boolean): Whether to join on team
- `on_alias` (String): Alias for ON clause
- `data_view_options` (Object): Query options with centralized references
  - `pid_reference` (String): Centralized player PID reference
  - `year_reference` (String): Centralized year reference
  - `week_reference` (String): Centralized week reference
  - `from_table_name` (String): Primary table name for the query
  - `from_table_type` (String): Type of from table ('table', 'cte')
- `is_team` (Boolean): Team-level join
- `week_table_name` (String): Week table name
- `team_unit` (String): 'off' or 'def'
- `opponent_clause_prefix` (String): Opponent matching prefix

**Complex Features**:

**Centralized Reference System**:

```javascript
// Use centralized player PID reference
this.on(`${table_name}.pid`, '=', data_view_options.pid_reference)

// Use centralized year reference for joins
this.andOn(db.raw(`${table_name}.year = ${data_view_options.year_reference}`))

// Use centralized week reference for joins
this.andOn(db.raw(`${table_name}.week = ${data_view_options.week_reference}`))
```

**Year Offset Handling**:

```javascript
// Single offset using centralized reference
if (year_offset === -1) {
  this.andOn(
    db.raw(`${table_name}.year = ${data_view_options.year_reference} + ?`, [-1])
  )
}

// Range offset (e.g., [-2, 0] for 3-year window)
if (Array.isArray(year_offset)) {
  this.andOn(
    db.raw(
      `${table_name}.year BETWEEN ${data_view_options.year_reference} + ? AND ${data_view_options.year_reference} + ?`,
      [year_offset[0], year_offset[1]]
    )
  )
}
```

**Self-Join Prevention**:

```javascript
// Skip join entirely if this table is the same as the from table (prevents self-join)
if (table_name !== data_view_options.from_table_name) {
  // Perform join logic
} else {
  log(`Skipping self-join for table: ${table_name}`)
}
```

**Team Opponent Matching**:

```javascript
// For defensive stats
if (team_unit === 'def' && matchup_opponent_type) {
  this.on(
    `${table_name}.${team}_team`,
    `=`,
    db.raw(`${opponent_table}.opponent`)
  )
}
```

**Performance Optimizations**:

- Uses appropriate join type based on filtering
- Leverages indexes through proper ON clauses
- Centralized references ensure consistent joins across all tables

## CTE Builders

### Week Opponent Tables (`week-opponent-cte-tables.mjs`)

#### `add_week_opponent_cte_tables({ players_query, table_name, week, year, seas_type })`

**Purpose**: Creates CTE mapping teams to their opponents for a specific week.

**Parameters**:

- `players_query` (Knex.QueryBuilder): Query to add CTE to
- `table_name` (String): Name for the CTE
- `week` (Number): NFL week
- `year` (Number): NFL season year
- `seas_type` (String): Season type (default 'REG')

**Generated CTE Structure**:

```sql
WITH ${table_name} AS (
  SELECT h as nfl_team, v as opponent FROM nfl_games WHERE ...
  UNION ALL
  SELECT v as nfl_team, h as opponent FROM nfl_games WHERE ...
)
```

### Play-by-Play WITH Statements (`add-player-stats-play-by-play-with-statement.mjs`)

#### `add_player_stats_play_by_play_with_statement(params)`

**Purpose**: Creates complex WITH statements for play-by-play statistics aggregation.

**Parameters**:

- `query` (Knex.QueryBuilder): Main query
- `params` (Object): Filter parameters
  - `career_year` (Array): Career year range
  - `career_game` (Array): Career game range
  - `year` (Array): Season years
  - `week` (Array): Season weeks
- `with_table_name` (String): CTE name (required)
- `having_clauses` (Array): Post-aggregation filters
- `select_strings` (Array): Custom SELECT expressions
- `pid_columns` (Array): Player ID columns to coalesce
- `splits` (Array): Active splits
- `where_clauses` (Array): Pre-aggregation filters
- `data_view_options` (Object): Query options with centralized references
  - `pid_reference` (String): Centralized player PID reference
  - `year_reference` (String): Centralized year reference
  - `week_reference` (String): Centralized week reference

**Key Features**:

- **Career Filtering**: Filters by career year/game ranges
- **Multiple Player IDs**: Coalesces different player ID columns
- **Split-Aware Grouping**: Adds appropriate GROUP BY for splits
- **WHERE vs HAVING**: Supports both pre and post aggregation filtering

**Error Handling**: Throws if `with_table_name` is missing.

## Rate Type System

### Rate Type Index (`rate-type/index.mjs`)

#### Rate Type Registry

```javascript
const rate_type_handlers = {
  per_game: { get_cte_table_name, add_cte, join_cte },
  per_team_play: { ... },
  per_team_pass_play: { ... },
  per_team_rush_play: { ... },
  per_team_half: { ... },
  per_team_quarter: { ... },
  per_team_drive: { ... },
  per_team_series: { ... },
  per_player_play: { ... },
  per_player_pass_play: { ... },
  per_player_rush_play: { ... },
  per_player_recv_play: { ... },
  per_player_rush_attempt: { ... },
  per_player_pass_attempt: { ... },
  per_player_target: { ... },
  per_player_reception: { ... },
  per_player_touch: { ... },
  per_player_route: { ... },
  per_player: { ... }
}
```

---

#### `get_rate_type_cte_table_name({ params, rate_type, team_unit, is_team })`

**Purpose**: Dispatches to appropriate rate type handler for CTE name generation.

**Parameters**:

- `params` (Object): Query parameters
- `rate_type` (String): Type of rate calculation
- `team_unit` (String): 'off' or 'def' for team rates
- `is_team` (Boolean): Team vs player rate

**Returns**: Unique CTE table name string

---

#### `add_rate_type_cte({ players_query, params, rate_type_table_name, splits, rate_type, team_unit, is_team })`

**Purpose**: Adds rate type CTE to query.

**Parameters**: Similar to above plus:

- `players_query` (Knex.QueryBuilder): Query builder
- `rate_type_table_name` (String): CTE name
- `splits` (Array): Active splits

**Effect**: Modifies query by adding WITH clause

---

#### `join_rate_type_cte({ players_query, params, rate_type_table_name, splits, rate_type, team_unit, is_team, data_view_options })`

**Purpose**: Joins rate type CTE to main query.

**Parameters**: Similar to above plus:

- `data_view_options` (Object): Contains centralized references including:
  - `pid_reference` (String): Centralized player PID reference
  - `year_reference` (String): Centralized year reference
  - `week_reference` (String): Centralized week reference

**Effect**: Adds appropriate JOIN clause using centralized references

### Rate Type Implementation Example (`rate-type-per-game.mjs`)

#### `get_per_game_cte_table_name({ params, team_unit, is_team })`

**Purpose**: Generates unique CTE name for per-game rates.

**Naming Pattern**:

```javascript
// Player: rate_type_per_game_2023_2024_REG
// Team: rate_type_per_team_game_off_2023_2024_REG
// Career: rate_type_per_game_career_year_1_10_REG
```

**Parameters Considered**:

- Years, weeks, career spans
- Team unit (offensive/defensive)
- Season type

---

#### `add_per_game_cte({ players_query, params, rate_type_table_name, splits })`

**Purpose**: Creates CTE counting games for rate calculations.

**Player Version**:

```sql
WITH rate_type_per_game_2024_REG AS (
  SELECT pid, COUNT(DISTINCT esbid) as rate_type_total_count
  FROM player_gamelogs_2024  -- Year-specific optimization
  WHERE seas_type = 'REG'
  GROUP BY pid
)
```

**Team Version**:

```sql
WITH rate_type_per_team_game_off_2024_REG AS (
  SELECT off_team as team, COUNT(DISTINCT esbid) as rate_type_total_count
  FROM nfl_plays
  WHERE seas_type = 'REG' AND year = 2024
  GROUP BY off_team
)
```

**Optimizations**:

- Uses year-specific tables when possible
- Filters inactive players
- Handles career spans efficiently

---

#### `join_per_game_cte({ players_query, rate_type_table_name, splits, params, team_unit, is_team, data_view_options })`

**Purpose**: Joins game count CTE for rate calculations.

**Parameters**:

- `players_query` (Knex.QueryBuilder): Query builder instance
- `rate_type_table_name` (String): CTE table name
- `splits` (Array): Active split dimensions
- `params` (Object): Query parameters including year_offset
- `team_unit` (String): 'off' or 'def' for team rates
- `is_team` (Boolean): Whether this is a team-level join
- `data_view_options` (Object): Contains centralized references

**Join Patterns**:

```javascript
// Simple join (no splits)
query.leftJoin(cte_name, `${cte_name}.pid`, data_view_options.pid_reference)

// Split-aware join using centralized references
query.leftJoin(cte_name, function () {
  this.on(`${cte_name}.pid`, data_view_options.pid_reference)
  this.on(`${cte_name}.year`, data_view_options.year_reference)
})

// Year offset join using centralized reference
query.leftJoin(cte_name, function () {
  this.on(`${cte_name}.pid`, data_view_options.pid_reference)
  this.on(
    db.raw(`${cte_name}.year = ${data_view_options.year_reference} + ?`, [
      year_offset
    ])
  )
})

// Week join using centralized reference
if (splits.includes('week')) {
  this.andOn(`${cte_name}.week`, '=', data_view_options.week_reference)
}
```

## Utility Functions

### Play-by-Play Defaults (`get-play-by-play-default-params.mjs`)

#### `get_play_by_play_default_params(params)`

**Purpose**: Normalizes parameters for play-by-play queries.

**Parameters**:

- `params` (Object): Input parameters

**Returns**: Normalized params with `seas_type` as array

**Default Behavior**:

```javascript
if (!params.seas_type) {
  params.seas_type = ['REG']
} else if (!Array.isArray(params.seas_type)) {
  params.seas_type = [params.seas_type]
}
```

### Cache Info for Fields (`get-cache-info-for-fields-from-plays.mjs`)

#### `get_cache_info_for_fields_from_plays()`

**Purpose**: Returns cache configuration for play-by-play field data.

**Returns**:

```javascript
{
  cache_ttl: 1000 * 60 * 60 * 24 * 7 // 1 week
}
```

**Note**: Simple static cache configuration.

### Stats Column Parameter Key (`get-stats-column-param-key.mjs`)

#### `get_stats_column_param_key(params)`

**Purpose**: Generates cache key from statistical parameters.

**Parameters**: Object with year, week, and other filters

**Returns**: Concatenated string key

**Example**: `"year_2023_2024_week_1_2_3_seas_type_REG"`

## Error Handling Patterns

### Validation Patterns

1. **Explicit Validation**:
   - `add_player_stats_play_by_play_with_statement` throws on missing table name
2. **SQL Execution Errors**:

   - Most functions rely on database to catch errors
   - Invalid SQL will fail at execution time

3. **Silent Failures**:
   - Missing column definitions skip processing
   - Invalid rate types are ignored

### Security Considerations

**SQL Injection Risks**:

- `where-string.mjs` uses string concatenation
- Values directly interpolated into SQL
- TODO comments indicate need for parameterization

**Recommended Fixes**:

```javascript
// Current (vulnerable)
return `${table_name}.${column_name} = '${value}'`

// Recommended (safe)
return { sql: `${table_name}.${column_name} = ?`, bindings: [value] }
```

## Performance Implications

### Query Optimization Strategies

1. **From Table Optimization**:

   - Starts queries from the most selective table based on sort columns
   - CTE tables (1-5K records) preferred over full tables (20K+ records)
   - Can reduce query time from 30+ seconds to under 5 seconds

2. **Centralized Reference System**:

   - Eliminates parameter duplication across functions
   - Ensures consistent join patterns throughout the system
   - Prevents self-joins when table is the same as from table

3. **Year-Specific Tables**:

   - `player_gamelogs_2024` instead of `player_gamelogs`
   - 10-100x performance improvement

4. **CTE Reuse**:

   - Rate type CTEs shared across columns
   - Reduces redundant calculations

5. **Join Type Selection**:

   - INNER JOIN when filtering (smaller result sets)
   - LEFT JOIN for optional data

6. **Index Usage**:
   - Year columns heavily indexed
   - Player ID (pid) primary lookup

### Caching Strategy Impact

1. **Granular TTLs**:

   - Current week: 5 minutes to 1 hour
   - Current season: 1-6 hours
   - Historical: 1-30 days

2. **Cache Key Design**:

   - Deterministic hashing ensures consistency
   - Parameter normalization prevents cache misses

3. **Memory Usage**:
   - CTEs reduce memory pressure
   - Split queries process data in chunks

### Scalability Considerations

1. **Horizontal Scaling**:

   - Stateless query building enables multiple instances
   - Cache can be shared across servers

2. **Vertical Scaling**:

   - Complex queries benefit from more CPU
   - CTEs use temporary memory

3. **Database Load**:
   - Year partitioning reduces scan size
   - Proper indexing critical for joins

## Migration Guide

### From Legacy Parameters to Centralized References

**Before** (deprecated approach):

```javascript
// Functions received separate parameters
function some_function({
  year_split_join_clause,
  week_split_join_clause,
  ...other_params
}) {
  // Used hardcoded references
  this.on('table.year', year_split_join_clause)
  this.on('table.week', week_split_join_clause)
}
```

**After** (current approach):

```javascript
// Functions receive data_view_options
function some_function({ data_view_options, ...other_params }) {
  // Use centralized references
  this.on('table.year', data_view_options.year_reference)
  this.on('table.week', data_view_options.week_reference)
  this.on('table.pid', data_view_options.pid_reference)
}
```

### Data View Options Structure

The `data_view_options` object now contains:

```javascript
{
  // From table configuration
  from_table_name: String,           // Primary table name
  from_table_type: String,           // Type: 'table', 'cte'
  from_table_column_id: String,      // Associated column ID

  // Centralized references
  pid_reference: String,      // e.g., 'player_fantasy_points.pid'
  year_reference: String,            // e.g., 'player_fantasy_points.year'
  week_reference: String,            // e.g., 'player_fantasy_points.week'

  // Legacy flags (maintained for compatibility)
  opening_days_joined: Boolean,
  player_seasonlogs_joined: Boolean,
  nfl_year_week_timestamp_joined: Boolean,
  year_coalesce_args: Array,
  rate_type_tables: Object,
  matchup_opponent_types: Set
}
```

### Benefits of the New System

1. **Performance**: Optimal from table selection can reduce query time by 85%+
2. **Consistency**: Centralized references ensure all joins use the same year/week/pid references
3. **Maintainability**: Single source of truth for table references
4. **Flexibility**: Support for complex CTE-based queries with proper join optimization
5. **Self-Join Prevention**: Automatic detection and prevention of redundant self-joins

This comprehensive function reference provides the detailed understanding needed for maintenance, optimization, and extension of the query builder system with the new centralized reference architecture.
