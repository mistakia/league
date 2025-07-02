# Query Builder Function Reference

This document provides comprehensive documentation for every function in the data views query builder system, organized by functional area.

## Table of Contents

1. [String Generation Functions](#string-generation-functions)
2. [Caching Infrastructure](#caching-infrastructure)
3. [Hashing Functions](#hashing-functions)
4. [Join Operations](#join-operations)
5. [CTE Builders](#cte-builders)
6. [Rate Type System](#rate-type-system)
7. [Utility Functions](#utility-functions)
8. [Error Handling Patterns](#error-handling-patterns)
9. [Performance Implications](#performance-implications)

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

#### `get_select_string({ column_id, column_params, column_index, column_definition, table_name, rate_type_column_mapping, splits, is_main_select })`

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

**Returns**:

```javascript
{
  select: Array<String>,  // SELECT expressions
  group_by: Array<String> // GROUP BY expressions
}
```

**Complex Features**:

- **Year Offset Ranges**: Handles `year_offset: [-2, 0]` for multi-year windows
- **Calculated Columns**: Supports numerator/denominator calculations
- **Rate Type Integration**: Automatically applies rate calculations
- **Split Awareness**: Adjusts SQL based on active splits

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

#### `get_where_string({ where_clause, column_definition, table_name, column_index, is_main_select, params, rate_type_column_mapping, splits })`

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

**Purpose**: Handles complex JOIN operations with extensive customization options.

**Parameters** (extensive object with following properties):

- `query` (Knex.QueryBuilder): Active query builder
- `table_name` (String): Table to join
- `join_table_clause` (String): Custom join clause
- `join_type` (String): 'LEFT' or 'INNER'
- `splits` (Array): Active splits
- `year_split_join_clause` (String): Year-based join condition
- `week_split_join_clause` (String): Week-based join condition
- `params` (Object): Query parameters
  - `year` (Array): Years to filter
  - `week` (Array): Weeks to filter
  - `year_offset` (Number|Array): Year offset handling
- `additional_conditions` (Function): Custom join conditions
- `join_year` (Boolean): Whether to join on year
- `join_week` (Boolean): Whether to join on week
- `join_on_team` (Boolean): Whether to join on team
- `on_alias` (String): Alias for ON clause
- `data_view_options` (Object): Query options
- `is_team` (Boolean): Team-level join
- `week_table_name` (String): Week table name
- `team_unit` (String): 'off' or 'def'
- `opponent_clause_prefix` (String): Opponent matching prefix

**Complex Features**:

**Year Offset Handling**:

```javascript
// Single offset
if (year_offset === -1) {
  this.on(`${table_name}.year`, `${splits_table}.year - 1`)
}

// Range offset (e.g., [-2, 0] for 3-year window)
if (Array.isArray(year_offset)) {
  this.on(
    `${table_name}.year`,
    '>=',
    db.raw(`${splits_table}.year + ?`, [year_offset[0]])
  )
  this.on(
    `${table_name}.year`,
    '<=',
    db.raw(`${splits_table}.year + ?`, [year_offset[1]])
  )
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
- Handles year-specific tables

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
- `data_view_options` (Object): Query options

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

#### `join_rate_type_cte({ players_query, params, rate_type_table_name, splits, year_split_join_clause, rate_type, team_unit, is_team })`

**Purpose**: Joins rate type CTE to main query.

**Parameters**: Similar to above plus:

- `year_split_join_clause` (String): Year join condition

**Effect**: Adds appropriate JOIN clause

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

#### `join_per_game_cte({ players_query, rate_type_table_name, splits, year_split_join_clause, params, team_unit, is_team })`

**Purpose**: Joins game count CTE for rate calculations.

**Join Patterns**:

```javascript
// Simple join (no splits)
query.leftJoin(cte_name, `${cte_name}.pid`, 'player.pid')

// Split-aware join
query.leftJoin(cte_name, function () {
  this.on(`${cte_name}.pid`, 'player.pid')
  this.on(`${cte_name}.year`, year_split_join_clause)
})

// Year offset join
query.leftJoin(cte_name, function () {
  this.on(`${cte_name}.pid`, 'player.pid')
  this.on(`${cte_name}.year`, db.raw('player_years.year - ?', [year_offset]))
})
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

1. **Year-Specific Tables**:

   - `player_gamelogs_2024` instead of `player_gamelogs`
   - 10-100x performance improvement

2. **CTE Reuse**:

   - Rate type CTEs shared across columns
   - Reduces redundant calculations

3. **Join Type Selection**:

   - INNER JOIN when filtering (smaller result sets)
   - LEFT JOIN for optional data

4. **Index Usage**:
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

This comprehensive function reference provides the detailed understanding needed for maintenance, optimization, and extension of the query builder system.
