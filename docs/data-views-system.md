# Data Views System: Query Builder and Column Architecture

This document provides comprehensive documentation of the data views system, focusing on the internal query builder architecture to help developers understand the current implementation for performance improvements and extensions.

## Table of Contents

1. [System Overview](#system-overview)
2. [Query Building Pipeline](#query-building-pipeline)
3. [Column Definition Architecture](#column-definition-architecture)
4. [Request Schema and API](#request-schema-and-api)
5. [Core Functions and Processing](#core-functions-and-processing)
6. [Table Grouping and Split System](#table-grouping-and-split-system)
7. [Rate Type System](#rate-type-system)
8. [Performance Optimization Strategies](#performance-optimization-strategies)
9. [State Management and Data Flow](#state-management-and-data-flow)
10. [Error Handling and Edge Cases](#error-handling-and-edge-cases)
11. [Performance Improvement Opportunities](#performance-improvement-opportunities)

## System Overview

The data views system provides a flexible, parameter-driven approach to building complex analytical queries for NFL fantasy football data. The architecture uses modular column definitions and a sophisticated multi-stage query builder to generate optimized SQL queries with comprehensive caching.

### Core Design Principles

**Modular Column Definitions**: Each metric is defined as a standalone column with encapsulated query logic, enabling flexible composition and parameter-driven behavior.

**Dynamic Table Aliasing**: Prevents naming conflicts when the same table is used with different parameters, using hash-based table naming.

**WITH Statement Pattern**: Complex aggregations use Common Table Expressions for performance optimization and code reusability.

**Plugin-Based Rate Types**: Statistical normalization (per-game, per-play) implemented through a plugin architecture.

**Split-Based Time Series**: Year/week splits enable time-series analysis through CTE-based query restructuring.

## Query Building Pipeline

### Pipeline Architecture

The query builder follows an 8-stage pipeline centered around `get_data_view_results_query()`:

```
Input Request
    ↓
[1] Input Validation & Schema Check
    ↓
[2] Parameter Processing & Dynamic Resolution
    ↓
[3] Base Query Initialization & State Setup
    ↓
[4] Split Handling & CTE Creation
    ↓
[5] Rate Type Discovery & CTE Generation
    ↓
[6] Table Grouping by Split Compatibility
    ↓
[7] Clause Application per Table Group
    ↓
[8] Sorting, Pagination & Query Finalization
    ↓
Final Query + Cache Metadata
```

### Critical Decision Points

Each stage makes key decisions that affect query performance:

- **Stage 1**: Validates schema and filters invalid where clauses
- **Stage 2**: Resolves dynamic parameters and format hashes
- **Stage 4**: Determines split strategy (none/year/week) and CTE structure
- **Stage 5**: Identifies required rate type CTEs for sharing
- **Stage 6**: Groups tables by split compatibility for processing order
- **Stage 7**: Selects JOIN type (INNER vs LEFT) based on filtering needs

### Performance-Critical Paths

**Single-Year Optimization**: When `params.year` contains a single year, the system uses partitioned tables (`player_gamelogs_2024`) for significant performance gains.

**Split-Based Filtering**: When week splits are enabled, incompatible rate types (like `per_game`) are automatically removed to prevent meaningless calculations.

**CTE Reuse**: Rate type CTEs are shared across multiple columns with identical parameters to reduce query complexity.

## Column Definition Architecture

### Standard Column Definition Structure

```javascript
{
  // Core identification
  table_name: 'player_gamelogs',          // Primary database table
  column_name: 'rec_yds',                 // Database column name

  // Query generation functions (performance-critical)
  main_select: ({ column_index, params, table_name, rate_type_column_mapping, splits }) => [
    {
      sql: `SUM(${table_name}.rec_yds) as receiving_yards_${column_index}`,
      bindings: []
    }
  ],

  main_where: ({ table_name, params, case_insensitive }) => {
    // Return SQL WHERE clause string
    return `${table_name}.pos = ?`
  },

  main_group_by: ({ table_name, column_index }) => [
    `${table_name}.pid`
  ],

  // Performance optimization functions
  table_alias: ({ params, splits }) => {
    // Use year-specific partitioned tables when possible
    if (params.year?.length === 1) return `player_gamelogs_${params.year[0]}`
    return 'player_gamelogs'
  },

  join: async ({ query, table_name, params, join_type, splits }) => {
    // Custom JOIN logic with performance considerations
    query.leftJoin(table_name, `${table_name}.pid`, 'player.pid')
  },

  // Cache optimization
  get_cache_info: ({ params }) => ({
    cache_ttl: params.year?.includes(constants.season.year)
      ? 60 * 60 * 1000          // 1 hour for current year
      : 24 * 60 * 60 * 1000     // 24 hours for historical
  }),

  // Metadata for optimization
  supported_splits: ['year', 'week'],
  supported_rate_types: ['per_game', 'per_team_play'],
  use_having: false,            // Use HAVING instead of WHERE for aggregates
}
```

### Advanced Column Definition (WITH Statements)

For complex aggregations that benefit from CTEs:

```javascript
{
  table_name: 'team_stats_from_plays',

  // CTE generation function
  with: ({ query, params, with_table_name, having_clauses, where_clauses }) => {
    query.with(with_table_name, (qb) => {
      qb.select([
        'nfl_plays.pos_team',
        db.raw('SUM(nfl_plays.rush_yds) as rushing_yards'),
        db.raw('COUNT(*) as play_count')
      ])
      .from('nfl_plays')
      .where('nfl_plays.play_type', 'RUSH')
      .groupBy('nfl_plays.pos_team')

      // Apply dynamic filtering
      if (where_clauses.length) qb.whereRaw(where_clauses.join(' AND '))
      if (having_clauses.length) qb.havingRaw(having_clauses.join(' AND '))
    })
  },

  with_select: ({ column_index, table_name }) => ({
    select: [`${table_name}.rushing_yards as team_rushing_yards_${column_index}`],
    group_by: []
  }),

  with_where: ({ table_name, params }) => {
    // WHERE clause for CTE
    return `${table_name}.play_count > 10`
  }
}
```

## Request Schema and API

### Request Structure

```javascript
POST /data_views/search
{
  columns: Array<ColumnConfig>,           // Main data columns
  prefix_columns: Array<ColumnConfig>,    // Additional columns (e.g., player info)
  where: Array<WhereClause>,              // Filter conditions
  sort: Array<SortClause>,                // Sorting configuration
  splits: Array<SplitType>,               // Time grouping ('year', 'week')
  offset: Number,                         // Pagination offset
  limit: Number                           // Result limit (max 500)
}
```

### Column Configuration Patterns

```javascript
// Simple column (performance-optimal)
"player_position"

// Parameterized column with rate type
{
  column_id: "player_fantasy_points_from_plays",
  params: {
    year: [2023, 2024],                   // Multi-year for trends
    week: [1, 2, 3, 4],                   // Week range
    scoring_format_hash: "half_ppr",      // Named format (auto-resolved)
    rate_type: ["per_game"]               // Statistical normalization
  }
}

// Dynamic parameters (resolved at query time)
{
  column_id: "player_rushing_yards_from_plays",
  params: {
    year: { dynamic_type: "last_n_years", value: 3 },    // Last 3 seasons
    week: { dynamic_type: "current_week" }               // Current week only
  }
}
```

### Where Clause Structure

```javascript
{
  column_id: "player_position",
  operator: "IN",                         // All standard SQL operators supported
  value: ["QB", "RB", "WR"],             // Values for filtering
  params: {                              // Column-specific parameters
    year: [2024],
    case_insensitive: true               // For string comparisons
  }
}
```

### Parameter System

**Time-Based Parameters**:

- `year`: Array or single year, auto-uses partitioned tables for single years
- `week`: Array or single week within season
- `seas_type`: Season type ('REG', 'POST', 'PRE')
- `year_offset`: For year calculations (e.g., previous season comparisons)

**Dynamic Parameters** (resolved at query time):

- `{ dynamic_type: "current_year" }` → Current NFL season
- `{ dynamic_type: "last_n_years", value: 3 }` → [2024, 2023, 2022]
- `{ dynamic_type: "current_week" }` → Current NFL week

**Performance Parameters**:

- `scoring_format_hash`: Scoring system (named formats auto-resolved to hashes)
- `league_format_hash`: League rules configuration
- `rate_type`: Statistical calculation method

**NFL Play Situational Parameters**:

- `play_type`, `down`, `distance`, `score_differential`
- `game_clock_range`, `field_position`
- `roof`, `surface`, `wind` conditions

## Core Functions and Processing

### Primary Orchestration Functions

#### `get_data_view_results_query()` - Main Pipeline Orchestrator

**Critical Performance Responsibilities**:

- Initializes query state and optimization flags
- Coordinates pipeline stages for optimal processing order
- Manages CTE creation and reuse strategies
- Controls JOIN type selection for performance

**Key Decision Logic**:

```javascript
// Determines split strategy based on request
if (splits.includes('week') || splits.includes('year')) {
  const year_range = get_year_range([...prefix_columns, ...columns], where)
  // Creates base_years CTE for cross-join optimization
}

// Optimizes rate type processing
if (splits.includes('week')) {
  // Removes incompatible per_game rate types
  columns = columns.map((column) =>
    column.params?.rate_type?.[0] === 'per_game'
      ? { ...column, params: { ...column.params, rate_type: undefined } }
      : column
  )
}
```

#### `add_clauses_for_table()` - Table Processing Core

**Performance-Critical Function**: Processes all columns and where clauses for a specific table, making key optimization decisions.

**Function Signature**:

```javascript
async add_clauses_for_table({
  players_query,           // Main Knex query builder
  select_columns = [],     // Columns to select from this table
  where_clauses = [],      // Filter conditions for this table
  table_name,              // Target table name or alias
  group_column_params = {},// Shared parameters for optimization
  splits = [],             // Active split dimensions
  year_split_join_clause,  // Year join condition
  week_split_join_clause,  // Week join condition
  rate_type_column_mapping,// Column to rate type table mapping
  data_view_options,       // Query-level optimization flags
  data_view_metadata       // Cache metadata tracking
})
```

**Internal Optimization Process**:

1. **Clause Collection**: Groups select and where operations
2. **SQL Generation**: Calls column definition functions with optimization context
3. **JOIN Strategy**: Selects INNER vs LEFT JOIN based on filtering needs
4. **CTE Processing**: Handles WITH statement requirements efficiently
5. **Query Application**: Applies optimized clauses to query builder

### Parameter Processing Functions

#### `process_dynamic_params(params)` - Dynamic Resolution

**Performance Impact**: Resolves dynamic parameters at query build time to enable optimization opportunities.

```javascript
// Transform dynamic to static for optimization
{ year: { dynamic_type: "last_n_years", value: 3 } }
// Becomes: { year: [2024, 2023, 2022] }
// Enables: Single-year table optimization when value = 1
```

#### `resolve_format_hash({ format_value, format_type })` - Format Resolution

**Optimization Purpose**: Converts named formats to hashes for consistent caching and query plan reuse.

### Table Grouping Functions

#### `get_grouped_clauses_by_table()` - Table Organization

**Performance Strategy**: Groups operations by table to minimize query complexity and enable batch processing.

**Grouping Result Structure**:

```javascript
{
  'player_gamelogs_2024': {           // Year-specific table (optimized)
    group_column_params: { year: [2024] },
    where_clauses: [...],
    select_columns: [...],
    supported_splits: ['week']
  },
  'player_gamelogs': {                // General table
    group_column_params: { year: [2023, 2022] },
    where_clauses: [...],
    select_columns: [...],
    supported_splits: ['year', 'week']
  }
}
```

#### `group_tables_by_supported_splits()` - Split Compatibility

**Optimization Logic**: Further groups tables by split support to ensure optimal processing order and prevent incompatible operations.

```javascript
{
  'year_week': {          // Tables supporting both splits (processed last)
    'player_gamelogs': {...},
    'nfl_plays': {...}
  },
  'year': {               // Year-only tables (processed middle)
    'player_seasonlogs': {...}
  },
  '': {                   // No split support (processed first)
    'player': {...}
  }
}
```

## Table Grouping and Split System

### Split Processing Performance Architecture

The split system restructures queries for time-series analysis while maintaining performance through strategic CTE usage.

#### Year Split Implementation

**CTE Strategy for Performance**:

```sql
-- Optimized year range generation
WITH base_years AS (
  SELECT unnest(ARRAY[2022,2023,2024]) as year
),
-- Cross-join optimization with optional filtering
player_years AS (
  SELECT DISTINCT player.pid, base_years.year
  FROM player CROSS JOIN base_years
  WHERE player.pos IN ('QB', 'RB', 'WR')  -- Early position filtering
)
```

**Query Structure Modification**:

```javascript
// Base query (no splits)
players_query.from('player')

// Year split optimization
players_query.from('player_years') // Start from filtered CTE
players_query.join('player', 'player.pid', 'player_years.pid')
```

#### Week Split Implementation

**Performance-Optimized CTE**:

```sql
WITH player_years_weeks AS (
  SELECT player_years.pid,
         nfl_year_week_timestamp.year,
         nfl_year_week_timestamp.week
  FROM player_years
  INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year
  WHERE nfl_year_week_timestamp.year = 2024  -- Single year optimization
)
```

**Performance Benefits**:

- Single-year filtering reduces CTE size significantly
- INNER JOIN on timestamp table leverages indexes
- Eliminates redundant player-week combinations

### Split Join Clause Generation

**Dynamic Join Optimization**:

```javascript
// Standard split joins
year_split_join_clause = 'player_years.year'
week_split_join_clause = 'player_years_weeks.week'

// Custom year selection with offset (for multi-year analysis)
year_split_join_clause = column_definition.year_select({
  table_name: 'player_gamelogs',
  splits: ['year'],
  column_params: { year_offset: [-1] } // Previous year comparison
})
// Returns: 'player_gamelogs.year - (-1)'
```

### Table Processing Order Optimization

**Performance-Driven Sorting**:

```javascript
const sorted_grouped_by_splits = Object.entries(grouped_by_splits).sort(
  ([key_a], [key_b]) => {
    const has_year_a = key_a.includes('year')
    const has_year_b = key_b.includes('year')
    if (has_year_a && !has_year_b) return 1 // Year tables last
    if (!has_year_a && has_year_b) return -1
    return 0
  }
)
```

**Processing Rationale**:

1. **Non-split tables first**: Establish base joins and indexes
2. **Year-only tables second**: Set up year-based joins
3. **Year+week tables last**: Leverage previously established joins

## Rate Type System

### Plugin Architecture for Performance

The rate type system uses a plugin-based architecture in `libs-server/data-views/rate-type/` for optimal performance and extensibility.

#### Rate Type Handler Structure

```javascript
// rate-type/rate-type-per-game.mjs
export const get_per_game_cte_table_name = ({ params, team_unit }) => {
  const years = Array.isArray(params.year) ? params.year : [params.year]
  const year_string = years.sort().join('_')
  const seas_type = params.seas_type || 'REG'
  return `rate_type_per_game_${year_string}_${seas_type}`
}

export const add_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits
}) => {
  const cte_query = db('player_gamelogs')
    .select([
      'player_gamelogs.pid',
      db.raw('COUNT(DISTINCT player_gamelogs.esbid) as rate_type_total_count')
    ])
    .where('player_gamelogs.seas_type', params.seas_type || 'REG')
    .groupBy('player_gamelogs.pid')

  // Year-specific table optimization
  if (params.year?.length === 1) {
    cte_query.from(`player_gamelogs_${params.year[0]}`)
  }

  if (params.year) {
    cte_query.whereIn(
      'player_gamelogs.year',
      Array.isArray(params.year) ? params.year : [params.year]
    )
  }

  players_query.with(rate_type_table_name, cte_query)
}

export const join_per_game_cte = ({
  players_query,
  rate_type_table_name,
  splits,
  year_split_join_clause
}) => {
  if (splits.includes('year')) {
    // Split-aware join for time-series analysis
    players_query.leftJoin(rate_type_table_name, function () {
      this.on(`${rate_type_table_name}.pid`, 'player.pid')
      this.on(`${rate_type_table_name}.year`, year_split_join_clause)
    })
  } else {
    // Simple join for aggregated analysis
    players_query.leftJoin(
      rate_type_table_name,
      `${rate_type_table_name}.pid`,
      'player.pid'
    )
  }
}
```

### Rate Type Processing Pipeline

#### Discovery and Optimization Phase

```javascript
// Identify and deduplicate rate types for CTE reuse
for (const [index, column] of [
  ...prefix_columns,
  ...columns,
  ...where
].entries()) {
  if (column.params?.rate_type) {
    const rate_type_table_name = get_rate_type_cte_table_name({
      params: column.params,
      rate_type,
      team_unit: column_definition.team_unit,
      is_team: column_definition.is_team
    })

    // Reuse CTEs across columns with identical parameters
    data_view_options.rate_type_tables[rate_type_table_name] = {
      params: column.params,
      rate_type,
      team_unit: column_definition.team_unit,
      is_team: column_definition.is_team
    }
  }
}
```

#### CTE Creation and JOIN Optimization

```javascript
// Create shared CTEs for performance
for (const [rate_type_table_name, config] of Object.entries(
  data_view_options.rate_type_tables
)) {
  add_rate_type_cte({
    players_query,
    params: config.params,
    rate_type_table_name,
    splits,
    rate_type: config.rate_type,
    team_unit: config.team_unit,
    is_team: config.is_team
  })

  join_rate_type_cte({
    players_query,
    params: config.params,
    rate_type_table_name,
    splits,
    year_split_join_clause,
    rate_type: config.rate_type,
    team_unit: config.team_unit,
    is_team: config.is_team
  })
}
```

### Rate Type SQL Generation

**Performance-Optimized Division Logic**:

```javascript
// Column definition main_select with rate type integration
main_select: ({ column_index, rate_type_column_mapping, table_name }) => {
  const rate_type_table_name =
    rate_type_column_mapping[`player_fantasy_points_from_plays_${column_index}`]

  if (rate_type_table_name) {
    return [
      {
        sql: `CASE 
        WHEN ${rate_type_table_name}.rate_type_total_count > 0 
        THEN CAST(SUM(${table_name}.fantasy_points) AS DECIMAL) / 
             CAST(${rate_type_table_name}.rate_type_total_count AS DECIMAL)
        ELSE NULL 
      END as fantasy_points_${column_index}`,
        bindings: []
      }
    ]
  }

  // Fallback to raw totals
  return [
    {
      sql: `SUM(${table_name}.fantasy_points) as fantasy_points_${column_index}`,
      bindings: []
    }
  ]
}
```

## Performance Optimization Strategies

### Year-Specific Table Selection

**Automatic Partitioned Table Usage**:

```javascript
// Column definition optimization
table_alias: ({ params, splits }) => {
  // Use partitioned tables for single-year queries (major performance gain)
  if (params.year && Array.isArray(params.year) && params.year.length === 1) {
    return `player_gamelogs_${params.year[0]}`
  }
  return 'player_gamelogs' // Use main table for multi-year
}
```

**Benefits**:

- 10-100x performance improvement for single-year queries
- Leverages PostgreSQL table partitioning
- Automatic index optimization
- Reduced scan size and memory usage

### Conditional Join Strategy

**Performance-Driven JOIN Selection**:

```javascript
await join_func({
  query: players_query,
  table_name,
  params: group_column_params,
  join_type: where_clauses.length ? 'INNER' : 'LEFT', // Key optimization
  splits,
  year_split_join_clause,
  week_split_join_clause,
  data_view_options
})
```

**Logic and Performance Impact**:

- **INNER JOIN**: When filtering (reduces result set size early)
- **LEFT JOIN**: For optional data (preserves all players for comprehensive analysis)
- **Performance gain**: INNER JOINs can reduce subsequent processing by 90%+

### CTE Reuse Strategy

**Shared CTE Management**:

```javascript
// Rate type CTEs shared across multiple columns
const rate_type_table_name = get_rate_type_cte_table_name({
  params: column.params,
  rate_type,
  team_unit: column_definition.team_unit,
  is_team: column_definition.is_team
})

// Only create CTE once, reference multiple times
data_view_options.rate_type_tables[rate_type_table_name] = config
```

**Performance Benefits**:

- Eliminates redundant CTE calculation
- Reduces query complexity and parse time
- Enables PostgreSQL query plan optimization

### Lazy Evaluation Pattern

**On-Demand Resource Creation**:

```javascript
// Only join tables when actually needed
if (join_func) {
  await join_func({
    /* join parameters */
  })
} else if (select_strings.length || main_where_clause_strings.length) {
  players_query.leftJoin(table_name, `${table_name}.pid`, 'player.pid')
}
```

**Memory and Performance Benefits**:

- Reduces unnecessary table scans
- Minimizes memory footprint
- Enables PostgreSQL to optimize JOIN order

## State Management and Data Flow

### Core State Objects

#### `data_view_options` - Query Optimization State

```javascript
const data_view_options = {
  // Join tracking for performance
  opening_days_joined: false, // Prevents duplicate expensive joins
  player_seasonlogs_joined: false, // Tracks seasonlogs table usage
  nfl_year_week_timestamp_joined: false, // Week timestamp join tracking

  // Optimization state
  year_coalesce_args: [], // Year selection optimization
  rate_type_tables: {}, // CTE reuse tracking
  matchup_opponent_types: new Set() // Required opponent CTEs
}
```

**Performance Usage Patterns**:

- **Join Tracking**: Prevents expensive duplicate joins
- **CTE Management**: Enables reuse across columns
- **Optimization Flags**: Conditional query modifications

#### `data_view_metadata` - Cache Optimization

```javascript
const data_view_metadata = {
  created_at: Date.now(),
  cache_ttl: 1000 * 60 * 60 * 24 * 7, // Conservative default: 1 week
  cache_expire_at: null // Absolute expiration
}
```

**Cache TTL Resolution Strategy**:

```javascript
const process_cache_info = ({ cache_info, data_view_metadata }) => {
  // Use shortest TTL across all columns (most restrictive)
  if (cache_info.cache_ttl < data_view_metadata.cache_ttl) {
    data_view_metadata.cache_ttl = cache_info.cache_ttl
  }

  // Use earliest expiration across all columns
  if (
    cache_info.cache_expire_at &&
    (cache_info.cache_expire_at < data_view_metadata.cache_expire_at ||
      !data_view_metadata.cache_expire_at)
  ) {
    data_view_metadata.cache_expire_at = cache_info.cache_expire_at
  }
}
```

#### `rate_type_column_mapping` - CTE Reference Tracking

```javascript
const rate_type_column_mapping = {
  player_fantasy_points_from_plays_0: 'rate_type_per_game_2024_REG',
  player_rushing_yards_from_plays_1: 'rate_type_per_play_2023_2024'
}
```

**Key Generation and Reuse**: `${column_id}_${column_index}` pattern enables precise CTE mapping while supporting multiple instances of the same column.

## Error Handling and Edge Cases

### Input Validation Strategy

#### Schema and Business Rule Validation

```javascript
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
    // Enhanced error context for debugging
    if (error.field?.startsWith('where[')) {
      const index = error.field.match(/\d+/)[0]
      return `${error.message} (${where[index]?.column_id}, ${where[index]?.operator}, ${where[index]?.value})`
    }
    return error.message
  })
  throw new Error(error_messages.join('\n'))
}
```

#### Value Filtering for Performance

```javascript
// Remove invalid where clauses early to optimize query building
where = where.filter((where_clause) => {
  return (
    where_clause.operator === 'IS NULL' ||
    where_clause.operator === 'IS NOT NULL' ||
    (where_clause.value !== null &&
      where_clause.value !== undefined &&
      where_clause.value !== '')
  )
})
```

### Graceful Degradation Patterns

#### Missing Column Handling

```javascript
const column_definition = data_views_column_definitions[column_id]
if (!column_definition) {
  log(`Column definition not found for column_id: ${column_id}`)
  continue  // Skip gracefully, don't fail entire query
}
```

#### Fallback Sort Column Detection

```javascript
// Multi-tier fallback for robust sorting
if (column_definition.sort_column_name) {
  // Primary: Explicit sort column name
  column_name =
    typeof column_definition.sort_column_name === 'function'
      ? column_definition.sort_column_name({ column_index, params })
      : column_definition.sort_column_name
} else if (column_definition.select_as) {
  // Secondary: Use select alias
  column_name = column_definition.select_as({ params })
} else if (column_definition.main_select) {
  // Tertiary: Extract from main_select pattern
  column_name = get_column_name_from_main_select(
    column_definition,
    column_index
  )
} else {
  // Last resort: SQL pattern matching
  select_position = find_column_position(players_query, resolved_pattern)
}
```

#### Rate Type Compatibility Filtering

```javascript
// Skip unsupported rate types without failing
if (
  !column_definition ||
  !column_definition.supported_rate_types ||
  !column_definition.supported_rate_types.includes(rate_type)
) {
  continue  // Graceful skip
}
```

## Function Reference

For comprehensive documentation of every function in the query builder system, see the [Query Builder Function Reference](./query-builder-function-reference.md). This includes:

- Complete parameter documentation for all functions
- Return value specifications
- Error handling patterns
- Performance implications
- Security considerations
- Usage examples

## Performance Improvement Opportunities

### Current Performance Bottlenecks

1. **Monolithic Query Builder**: `get_data_view_results_query()` is a 1500+ line function that's difficult to optimize
2. **State Scattered Across Objects**: Performance state spread across multiple objects reduces optimization opportunities
3. **Sequential Table Processing**: Tables processed one at a time instead of leveraging parallel opportunities
4. **Manual Cache Management**: Cache TTL logic duplicated across column definitions
5. **SQL Injection Risks**: String concatenation in WHERE clause generation (see Function Reference for details)

### Immediate Performance Improvements

#### 1. Query Plan Caching

**Opportunity**: Cache compiled query plans for repeated parameter patterns

```javascript
const queryPlanCache = new Map()

function getCachedQueryPlan(requestHash) {
  if (queryPlanCache.has(requestHash)) {
    return queryPlanCache.get(requestHash) // ~90% of queries are repeats
  }

  const plan = compileQueryPlan(request)
  queryPlanCache.set(requestHash, plan)
  return plan
}
```

**Expected Impact**: 40-60% reduction in query build time for repeated patterns

#### 2. Lazy Column Evaluation

**Opportunity**: Only process columns that are actually needed

```javascript
class LazyColumnProcessor {
  constructor(columnDefinitions) {
    this.columnDefinitions = columnDefinitions
    this.processedColumns = new Map()
  }

  getColumn(columnId, params) {
    const key = `${columnId}_${hashParams(params)}`
    if (!this.processedColumns.has(key)) {
      this.processedColumns.set(key, this.processColumn(columnId, params))
    }
    return this.processedColumns.get(key)
  }
}
```

**Expected Impact**: 20-30% reduction in processing overhead for sparse column sets

#### 3. Batch Rate Type Processing

**Opportunity**: Process similar rate types together

```javascript
function groupRateTypesByStrategy(rateTypes) {
  return rateTypes.reduce((groups, rateType) => {
    const strategy = getRateTypeStrategy(rateType) // per_game, per_play, etc.
    if (!groups[strategy]) groups[strategy] = []
    groups[strategy].push(rateType)
    return groups
  }, {})
}
```

**Expected Impact**: 30-50% reduction in CTE creation overhead

### Architectural Improvements for Performance

#### 1. Pipeline Pattern Implementation

**Current Issue**: Monolithic function with scattered optimization logic
**Solution**: Discrete, optimizable pipeline stages

```javascript
class QueryPipeline {
  constructor() {
    this.stages = [
      new ValidationStage(),
      new ParameterOptimizationStage(), // New: Parameter-based optimizations
      new SplitOptimizationStage(), // New: Split-specific optimizations
      new RateTypeOptimizationStage(), // New: Rate type batching
      new TableGroupingStage(),
      new ClauseApplicationStage(),
      new QueryOptimizationStage() // New: Final query optimizations
    ]
  }

  async execute(request) {
    let context = new QueryContext(request)
    for (const stage of this.stages) {
      context = await stage.process(context)
      // Each stage can add optimization metadata
    }
    return context.getOptimizedResult()
  }
}
```

#### 2. Centralized Performance State

**Current Issue**: Optimization flags scattered across multiple objects
**Solution**: Unified performance tracking

```javascript
class QueryPerformanceContext {
  constructor() {
    this.optimizations = {
      usePartitionedTables: new Set(), // Track partitioned table usage
      sharedCTEs: new Map(), // CTE reuse tracking
      joinStrategy: new Map(), // JOIN type decisions
      indexHints: [] // Index usage hints
    }
    this.cacheStrategy = {
      ttl: Infinity,
      expireAt: null,
      dependencies: new Set()
    }
  }

  addPartitionedTable(tableName, year) {
    this.optimizations.usePartitionedTables.add(`${tableName}_${year}`)
  }

  sharesCTE(cteId, config) {
    this.optimizations.sharedCTEs.set(cteId, config)
  }
}
```

#### 3. Query Compilation Strategy

**Current Issue**: Query built incrementally without global optimization
**Solution**: Two-phase compilation for optimization opportunities

```javascript
class QueryCompiler {
  compile(request) {
    // Phase 1: Analysis and optimization planning
    const analysis = this.analyzeRequest(request)
    const optimizationPlan = this.createOptimizationPlan(analysis)

    // Phase 2: Optimized query generation
    return this.generateOptimizedQuery(request, optimizationPlan)
  }

  analyzeRequest(request) {
    return {
      tableUsage: this.analyzeTableUsage(request),
      rateTypePatterns: this.analyzeRateTypes(request),
      splitRequirements: this.analyzeSplits(request),
      cacheOptimizations: this.analyzeCaching(request)
    }
  }
}
```

### Long-Term Performance Architecture

#### 1. Materialized View Strategy

**Opportunity**: Pre-compute common aggregations

- Player season totals by scoring format
- Team statistics by week/year
- Rate type denominators by common parameter combinations

#### 2. Index Optimization Strategy

**Current Gap**: No systematic index usage tracking
**Solution**: Query-specific index recommendations and monitoring

#### 3. Parallel Processing Architecture

**Opportunity**: Process independent table groups in parallel
**Implementation**: Worker pool for table processing with shared CTE coordination

## Parameter Documentation Standards

To ensure future maintainability, all functions should follow these parameter documentation patterns:

### Required Documentation Elements

1. **Purpose Statement**: Clear one-line description of what the function does
2. **Parameter List**: Each parameter with:
   - Name and type
   - Required vs optional status
   - Default values if applicable
   - Valid value ranges or enums
   - Example values
3. **Return Value**: Type and structure of return value
4. **Error Conditions**: When the function throws or returns errors
5. **Performance Notes**: Any performance implications
6. **Usage Examples**: Real-world usage patterns

### Example Documentation Pattern

```javascript
/**
 * Generates SQL WHERE clause for column filtering
 *
 * @param {Object} params - Parameters object
 * @param {Object} params.where_clause - Filter specification
 * @param {String} params.where_clause.operator - SQL operator (IN, =, >, etc.)
 * @param {Any} params.where_clause.value - Filter value(s)
 * @param {Object} params.column_definition - Column configuration from definitions
 * @param {String} params.table_name - Target table name (may be aliased)
 * @param {Number} [params.column_index=0] - Column instance index
 * @param {Boolean} [params.case_insensitive=false] - Enable case-insensitive string comparison
 *
 * @returns {String} SQL WHERE clause fragment
 *
 * @throws {Error} When operator is not supported
 *
 * @performance Uses string concatenation - consider parameterized queries
 *
 * @example
 * get_where_string({
 *   where_clause: { operator: 'IN', value: ['QB', 'RB'] },
 *   column_definition: playerPositionDef,
 *   table_name: 'player'
 * })
 * // Returns: "player.pos IN ('QB', 'RB')"
 */
```

### Parameter Validation Best Practices

1. **Type Checking**: Validate parameter types at function entry
2. **Required Parameters**: Throw descriptive errors for missing required params
3. **Default Values**: Use parameter defaults rather than internal fallbacks
4. **Range Validation**: Check numeric parameters are within valid ranges
5. **Enum Validation**: Verify string parameters match expected values

This comprehensive documentation provides the foundation for understanding the current implementation and guides performance improvements while maintaining the system's analytical capabilities and flexibility.
