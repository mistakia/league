# Query Builder Function Reference

This document provides comprehensive documentation for every function in the data views query builder system, organized by functional area.

## Table of Contents

1. [Primary Table Optimization](#primary-table-optimization)
2. [String Generation Functions](#string-generation-functions)
3. [Caching Infrastructure](#caching-infrastructure)
4. [Hashing Functions](#hashing-functions)
5. [Join Operations](#join-operations)
6. [CTE Builders](#cte-builders)
7. [Output Aggregation](#output-aggregation)
8. [Utility Functions](#utility-functions)
9. [Error Handling Patterns](#error-handling-patterns)
10. [Performance Implications](#performance-implications)

## Primary Table Optimization

### Query Initialization Functions (`get-data-view-results.mjs`)

**Note**: This section documents the new centralized reference system that replaces the deprecated `year_split_join_clause` and `week_split_join_clause` parameters. All functions now use `data_view_options` with centralized references for consistent year/week joins and player ID references.

#### `determine_from_table({ sort, columns, prefix_columns, row_axes, data_views_column_definitions })`

**Purpose**: Analyzes sort columns to identify the optimal starting table for query performance.

**Parameters**:

- `sort` (Array): Sort configuration from user request
- `columns` (Array): Column configurations
- `prefix_columns` (Array): Prefix column configurations
- `row_axes` (Array): Active split dimensions ['year', 'week']
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
3. Validates split compatibility with requested row_axes

**Example**:

```javascript
// Sort by fantasy points (CTE table)
determine_from_table({
  sort: [{ column_id: 'player_fantasy_points_from_plays', desc: true }],
  columns: [],
  prefix_columns: [],
  row_axes: ['year'],
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

#### `setup_default_from_table(row_axes)`

**Purpose**: Sets up the default from table configuration based on row_axes when no sort-based optimization is available.

**Parameters**:

- `row_axes` (Array): Active split dimensions ['year', 'week']

**Returns**:

```javascript
{
  from_table_name: String,           // Default from table name
  from_table_type: String            // Table type ('table', 'cte')
}
```

**Logic**:

```javascript
// Week row_axes require player_years_weeks CTE
if (row_axes.includes('week')) {
  return { from_table_name: 'player_years_weeks', ... }
}
// Year row_axes require player_years CTE
else if (row_axes.includes('year')) {
  return { from_table_name: 'player_years', ... }
}
// No row_axes use base player table
else {
  return { from_table_name: 'player', ... }
}
```

---

#### `get_from_table_config({ sort, columns, prefix_columns, row_axes, data_views_column_definitions })`

**Purpose**: Determines the final from table to use for the query by combining sort-based optimization with row_axes requirements.

**Parameters**:

- `sort` (Array): Sort configuration
- `columns` (Array): Column configurations
- `prefix_columns` (Array): Prefix column configurations
- `row_axes` (Array): Active split dimensions
- `data_views_column_definitions` (Object): Column definition registry

**Returns**: Final from table configuration object

**Decision Logic**:

1. Attempts sort-based from table optimization
2. Uses sort-based table if no row_axes are configured OR if table supports required row_axes
3. Falls back to default row_axes-based table selection

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

#### `resolve_references({ identity_id, from_table_name })`

**Module**: `libs-server/data-views/identities.mjs`

**Purpose**: Resolves the four subject references a join fragment binds against — `pid_reference`, `team_reference`, `year_reference`, `week_reference` — from the active identity, adapted to the FROM table that sort optimization selected.

**Parameters**:

- `identity_id` (String): one of `player`, `player_year`, `player_year_week`, `team`, `team_year`, `team_year_week`
- `from_table_name` (String): the table the query FROMs, which may be a fact table rather than the identity's canonical source

**Returns**: `{ pid_reference, team_reference, year_reference, week_reference }`

**Logic**: team identities resolve to the identity's own columns; a player query on the canonical `player` FROM resolves to the identity CTEs (`player.pid`, `player_years.year`); a player query optimized onto a fact table resolves to that table's own columns, so the reference needs no bridge CTE.

**Usage**: `build_query_context` calls it to populate `query_context`, which is the identity-derived source of truth. The dispatcher mirrors the FROM-aware result onto `data_view_options` for the shared join helpers that still read from it. This replaced `setup_central_references`, which derived all three references from the FROM table name alone and had no notion of identity.

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

#### `get_table_name({ column_definition, column_params, row_axes })`

**Purpose**: Determines the appropriate table name for a column based on its definition and parameters.

**Parameters**:

- `column_definition` (Object): Column configuration from definitions
- `column_params` (Object): Column-specific parameters
- `row_axes` (Array): Active split dimensions

**Returns**: String - Table name (may be aliased or generated)

**Logic**:

```javascript
return column_definition.table_alias
  ? column_definition.table_alias({ params: column_params, row_axes })
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

#### `get_select_string({ column_id, column_params, column_index, column_definition, table_name, rate_type_column_mapping, row_axes, is_main_select, data_view_options })`

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
- `row_axes` (Array): Active split dimensions ['year', 'week']
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

#### `get_where_string({ where_clause, column_definition, table_name, column_index, is_main_select, params, rate_type_column_mapping, row_axes, data_view_options })`

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
- `row_axes` (Array): Active splits
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

#### `get_data_view_hash({ row_axes, where, columns, prefix_columns, sort, offset, limit })`

**Purpose**: Creates deterministic hash for cache key generation.

**Parameters**:

- `row_axes` (Array): Split dimensions
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

### Source Attach (`source-attach/dispatcher.mjs`)

#### `attach_source({ players_query, query_context, column_def, params, table_alias, join_type, row_axes })`

**Purpose**: Attaches a column's data source to the query. This replaced `data-view-join-function.mjs`, which took a `join_on_team` flag and a long list of join-shape options; a column now declares a `source` descriptor and the registry decides the join.

**Resolution**: derives the mode from `params.matchup_opponent_type`, looks up a rule by `(cell identity, source grain, mode)` in `source-attach/source-attach-registry.mjs`, and falls back to `'default'` mode when a non-default mode has no registered entry.

**Rules** live under `source-attach/rules/` and export `{ cell_identity, source_grain, mode, required_identity_bridges, emit_predicate }`. The dispatcher applies every bridge in `required_identity_bridges` via `apply_bridge`, then emits the join through `emit_predicate` unless the source sets `attach_owns_join`, then calls the source's own `attach()` if it declares one.

**Constraint mechanism**: registry presence. A `(cell identity, source grain, mode)` combination with no rule fails resolution, which is how matchup-opponent columns are unavailable under the team row grain without any column declaring a restriction.

**Performance Optimizations**:

- Uses appropriate join type based on filtering
- Leverages indexes through proper ON clauses
- Identity-derived references ensure consistent joins across all tables

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
  SELECT home_nfl_team as nfl_team, away_nfl_team as opponent FROM nfl_games WHERE ...
  UNION ALL
  SELECT away_nfl_team as nfl_team, home_nfl_team as opponent FROM nfl_games WHERE ...
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
- `row_axes` (Array): Active splits
- `where_clauses` (Array): Pre-aggregation filters
- `data_view_options` (Object): Query options with centralized references
  - `pid_reference` (String): Centralized player PID reference
  - `year_reference` (String): Centralized year reference
  - `week_reference` (String): Centralized week reference

**Key Features**:

- **Career Filtering**: Filters by career year/game ranges
- **Multiple Player IDs**: Coalesces different player ID columns
- **Split-Aware Grouping**: Adds appropriate GROUP BY for row_axes
- **WHERE vs HAVING**: Supports both pre and post aggregation filtering

**Error Handling**: Throws if `with_table_name` is missing.

## Output Aggregation

### Output Aggregator Registry (`output-aggregator-registry.mjs`)

The registry is a `Map<period, Map<aggregation, plugin>>`. It replaced the `rate_type_handlers` dispatch map, which keyed on a `rate_type` string and exposed `{get_cte_table_name, add_cte, join_cte}`.

#### `resolve({ period, aggregation, column_def })`

Returns the plugin for a `(period, aggregation)` tuple. A column definition may override registry lookup with `column_def.output_aggregator`.

Registered `rate` periods: `game`, `team_play`, `team_pass_play`, `team_rush_play`, `team_half`, `team_quarter`, `team_drive`, `team_series`, `player_rush_attempt`, `player_pass_attempt`, `player_target`, `player_catchable_target`, `player_deep_target`, `player_catchable_deep_target`, `player_reception`, `player_touch`, `player_opportunity`, `player_play`, `player_pass_play`, `player_rush_play`, `player_route`. Registered `count` periods: `game`, `season`.

#### `apply_output_aggregator({ query_context, column_def, params, identity_id, column_index })`

Orchestrates one column: resolve the plugin, name the CTE, `add_cte`, `join_cte` (deduped against `query_context.joined_output_ctes`), attach a separate numerator CTE when the plugin does not handle its own, then `emit_outer_select`.

### Plugin interface

Every plugin exports:

- `consumes_params` (Array of String) — declarative allowlist of param keys the plugin reads, never inferred. It feeds the CTE-name hash, so a param that changes the CTE's contents but is missing here makes two columns differing only in that param share one CTE and return identical values.
- `get_cte_name({ column_def, params, identity_id, dispatch_params })`
- `add_cte(...)` — registers via `withMaterialized`, never `with`
- `join_cte(...)` — joins on identity-derived references
- `emit_outer_select(...)` — returns `{ sql, bindings }`

### Period CTE builder (`output-aggregator/build-period-cte.mjs`)

`period` is `game` (period key `year_week_esbid`), `season` (period key `year_seastype`), or `aggregate` (numerator-only, no period key). Anything else throws.

`build_role_union_period_cte` handles `measure_source: 'plays_role_union'` — one play attributing to several players — via `UNION ALL` over role attributions. `build_batched_period_cte` handles every other source and coalesces measures sharing a scan signature into one CTE.

### Measure batching (`output-aggregator/measure-batch.mjs`)

`compute_group_key` keys on measure source, period, identity, sorted pid columns, rendered measure predicate, `apply_filters` body, team unit, and the consumed-params signature. CTE names are `rate_<period>_<md5 prefix>`. Registration is deferred until `flush_measure_batches` runs after the per-column dispatch loop.

### Denominator CTE builders (`period-denominator/`)

The per-period denominator builders live under `libs-server/data-views/period-denominator/` — `per-game.mjs`, `per-team-play.mjs`, `per-player.mjs`, `per-player-play.mjs`, `per-player-route.mjs`. They are the live implementation, not a compat shim, and are bound to their `(period, 'rate')` tuples by the registry, which is module-keyed: one module serves a denominator family across several period tokens. There is no `index.mjs` dispatcher.

Their author invariants — apply `effective_years` as a `WHERE ... IN` on every year-partitioned table scanned, and register every CTE with `withMaterialized` — are in `libs-server/data-views/period-denominator/ABOUT.md`.

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
// Functions receive query_context
function some_function({ query_context, ...other_params }) {
  // Use identity-derived references
  this.on('table.year', query_context.year_reference)
  this.on('table.week', query_context.week_reference)
  this.on('table.pid', query_context.pid_reference)
}
```

`query_context` (`libs-server/data-views/query-context.mjs`) is the identity-derived source of truth: `identity_id`, `row_grain_id`, `row_grain`, `row_axes`, `year_range`, `nfl_week_ids`, `params`, the four references, `is_team`, `having_clauses`, and the idempotency sets `applied_bridges`, `applied_output_ctes`, `joined_output_ctes`, `registered_ctes`.

### Data View Options Structure

`data_view_options` survives as the FROM-table-aware override layer, because sort optimization can promote a fact table to the FROM and the references then have to point at it. It contains:

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
