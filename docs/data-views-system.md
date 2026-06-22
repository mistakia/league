# Data Views System: Query Builder and Column Architecture

This document provides comprehensive documentation of the data views system, focusing on the internal query builder architecture to help developers understand the current implementation for performance improvements and extensions.

## Table of Contents

1. [System Overview](#system-overview)
2. [Query Building Pipeline](#query-building-pipeline)
3. [Column Definition Architecture](#column-definition-architecture)
4. [Request Schema and API](#request-schema-and-api)
5. [Core Functions and Processing](#core-functions-and-processing)
6. [Table Grouping and Split System](#table-grouping-and-split-system)
7. [Measure-First Column Contract](#measure-first-column-contract)
8. [Rate Type System](#rate-type-system)
9. [Performance Optimization Strategies](#performance-optimization-strategies)
10. [State Management and Data Flow](#state-management-and-data-flow)
11. [Error Handling and Edge Cases](#error-handling-and-edge-cases)
12. [Performance Improvement Opportunities](#performance-improvement-opportunities)
13. [Related Documentation](#related-documentation)

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

The query builder follows a 9-stage pipeline centered around `get_data_view_results_query()`:

```
Input Request
    ↓
[1] Input Validation & Schema Check
    ↓
[2] Parameter Processing & Dynamic Resolution
    ↓
[3] From Table Optimization & Base Query Setup
    ↓
[4] Split Handling & CTE Creation
    ↓
[5] Centralized Reference Setup
    ↓
[6] Rate Type Discovery & CTE Generation
    ↓
[7] Table Grouping by Split Compatibility
    ↓
[8] Clause Application per Table Group
    ↓
[9] Sorting, Pagination & Query Finalization
    ↓
Final Query + Cache Metadata
```

### Critical Decision Points

Each stage makes key decisions that affect query performance:

- **Stage 1**: Validates schema and filters invalid where clauses
- **Stage 2**: Resolves dynamic parameters and format hashes
- **Stage 3**: Determines optimal from table and sets up base query structure
- **Stage 4**: Determines split strategy (none/year/week) and CTE structure
- **Stage 5**: Sets up centralized references for consistent join patterns
- **Stage 6**: Identifies required rate type CTEs for sharing
- **Stage 7**: Groups tables by split compatibility for processing order
- **Stage 8**: Selects JOIN type (INNER vs LEFT) based on filtering needs

### Performance-Critical Paths

**From Table Optimization**: When sort columns specify a CTE table, the system starts the query from that table instead of the default `player` table. Uses whitelist system for gradual rollout.

**Centralized Reference System**: All year/week/PID joins use centralized references from `data_view_options` instead of passing individual join clauses to each function.

**Single-Year Optimization**: When `params.year` contains a single year, the system uses partitioned tables (`player_gamelogs_2024`) for significant performance gains.

**Split-Based Filtering**: When week splits are enabled, incompatible rate types (like `per_game`) are automatically removed to prevent meaningless calculations.

**CTE Reuse**: Rate type CTEs are shared across multiple columns with identical parameters to reduce query complexity.

**Canonical filter shape**: `nfl_week_id` is the canonical time-scope filter at the params layer. When the user supplies only `year` (with optional `seas_type`, defaulted to `['REG']`), `resolve_nfl_week_id_from_year_param` expands to the full cross-product of (year, seas_type) weeks. At SQL emit time, `apply_play_by_play_column_params_to_query` decomposes the IN-list via `decompose_nfl_weeks` and always emits derived `year IN (...)` and `seas_type IN (...)` predicates — these engage partition pruning on `nfl_plays` and the `(year, seas_type, ...)` composite indexes. The `nfl_week_id IN (...)` predicate itself is emitted only when the IN-list is a strict subset of the (year × seas_type) cross-product (user narrowed to specific weeks); when it equals the full cross-product, `is_full_year_seas_type_coverage` returns true and the redundant IN-list is dropped. Column authors that filter on `nfl_plays.nfl_week_id` directly (outside `apply_play_by_play_column_params_to_query`) should follow the same pattern: decompose to (years, seas_types) and emit derived predicates alongside any IN-list.

**Historical-Team Joins for `per_team_play` Denominators**: `rate-type-per-team-play.mjs` attributes the team-aggregated denominator (`per_team_pass_play`, `per_team_rush_play`, etc.) to the player's team-of-record per (pid, year) via the `player_year_teams` bridge CTE (materialized by the `player_year` -> `team_year` entry in `identity-bridge-registry.mjs`). Three branches share that bridge:

1. **Single-year snapshot join** (single `params.year`, or splits include `year` resolving to one year, no `year_offset` range): `join_per_team_play_cte` joins the denominator on `player_year_teams.team` with `andOn(rate_type_table_name.year = <specific_year>)`. The bridge's own `join_cte` pins `player_year_teams` to `max(year_range)`, which for the single-year case is that year. Denominator CTE is grouped by `off` only.
2. **Year-split per-(pid, year) row grain** (`splits.includes('year')`): the denominator CTE adds `nfl_plays.year` to its select and group-by so each (off, year) cell is addressable; the join binds `rate_type_table_name.year = data_view_options.year_reference`. Attribution is structural to the row grain — no wrap needed because each output row already carries its own year.
3. **Multi-year-no-split wrap CTE** (`requires_wrap` in `per-team-play-wrap.mjs`: player subject, 2+ distinct effective years, no `year` split, no `matchup_opponent_type`): `add_per_team_play_cte` is invoked with `force_year_grain=true` so the denominator is grouped by `(off, year)`. `join_cte` then registers a per-column wrap CTE (`flush_per_team_play_wraps` materializes it after `flush_measure_batches`) that recomputes the numerator at (pid, year) grain inline, INNER JOINs `player_year_teams` on (pid, year) and the denominator on (team, year), then groups back to pid. The outer query LEFT JOINs the wrap on pid and divides `MAX(numerator_sum) / NULLIF(MAX(denominator_sum), 0)`. Without the wrap, a player who changed teams (Davante Adams: LV/2023 -> NYJ/2024 -> LA/2025) would have his multi-year stats divided by a single `max(year_range)` team's count; players with no row for `max(year_range)` would return NULL even when they accumulated stats in prior years.

**Team `per_game` denominator grain**: `rate-type-per-game.mjs`'s `add_team_per_game_cte` counts games per team from `nfl_games` (home/away `UNION ALL` → `COUNT(*)`) and partitions by `year` **only when a year split is active**, matching `build-period-cte`'s `include_year` invariant (and the player per-game denominator). Unsplit, this is one row per team (full-window game count, ~team-invariant: 51 over 2023-2025 REG); under a year split it is one row per `(team, year)` for a year-correlated 1:1 join. Grouping by year unconditionally fans the denominator into `(team, year)` while the numerator stays a full multi-year total, so the outer `MAX()` collapses to a single season's game count and inflates every team per-game rate by ~N (years in window) — the 2026-06-20 grain bug (commit cbcfb8c4). Residual: the `per_game` team path still joins its numerator via `player_year_teams` (2025 team) but its denominator on `player.current_nfl_team`; post-fix the denominator is team-invariant so the only effect is that an offseason team-changer's displayed team volume reflects their 2025 team, not their new team (unlike `per_team_play`, which routes both through `identity_bridge_registry`).

**Historical-Team Joins for `team_*_from_plays` Columns**: `team-stats-from-plays-wrap.mjs` applies the same three-branch shape to the team-variant of `team_*_from_plays` columns (e.g. `team_pass_yards_from_plays` on a player view, `force_player_active=false`). The wrap-mode predicate (`requires_team_stats_wrap`) is symmetric to `per_team_play`'s: player subject, multi-year effective scope, no `year` split, no `week` split (a week split would fan the pid-grain wrap across every per-week row), no `matchup_opponent_type`. In wrap mode the base `_team_stats` CTE in `add_team_stats_play_by_play_with_statement` is promoted to `(nfl_team, year)` grain and the wrap CTE re-keys it on pid via `player_year_teams`; in the single-year and year-split branches the standard `nfl_team`-keyed shape is retained. The `_player_team_stats` variant (`force_player_active=true`) is exempt because it already keys on pid through its internal `player_gamelogs` join. The shared `requires_wrap` predicate inputs (effective-year resolution via `compute_effective_scope`, matchup-param extraction) live in `libs-server/data-views/wrap-predicates.mjs` so both modules consume one definition. Wrap-mode decisions are memoized on `query_context.team_stats_wrap_decisions` so `compute_effective_scope` is not re-run per column.

## Column Definition Architecture

### Standard Column Definition Structure

```javascript
{
  // Core identification
  table_name: 'player_gamelogs',          // Primary database table
  column_name: 'rec_yds',                 // Database column name

  // Query generation functions (performance-critical)
  main_select: ({ column_index, params, table_name, rate_type_column_mapping, splits, data_view_options }) => [
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

  join: async ({ query, table_name, params, join_type, splits, data_view_options }) => {
    // Custom JOIN logic with performance considerations
    query.leftJoin(table_name, `${table_name}.pid`, data_view_options.pid_reference)
  },

  // Join control parameters
  skip_week_split_join: true,    // Skip week join for season-level data
  join_week: false,              // Don't join on week column

  // Cache optimization
  get_cache_info: ({ params }) => ({
    cache_ttl: params.year?.includes(constants.current_season.year)
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

For complex aggregations that benefit from CTEs (see [Fantasy Points Column Definition](./fantasy-points-column-definition.md) for a comprehensive real-world example):

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

  with_select: ({ column_index, table_name, data_view_options }) => ({
    select: [`${table_name}.rushing_yards as team_rushing_yards_${column_index}`],
    group_by: []
  }),

  with_where: ({ table_name, params }) => {
    // Returns column expression for CTE filtering
    return 'rushing_yards'
  }
}
```

## Request Schema and API

### Request Structure

The complete request schema is documented in [`data-view-request-schema.json`](./data-view-request-schema.json). Performance guidelines and parameter compatibility rules are available in the [`data-view-specs/`](./data-view-specs/) folder.

```javascript
POST /data-views/search
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

#### Three NFL Week / Year Param Flavors

Weekly data-view columns use one of three param flavors, picked by the data's natural grain:

| Flavor                    | Param                  | Cardinality    | Used by                                                                                                                           |
| ------------------------- | ---------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Season-level              | `single_year` / `year` | scalar / multi | ADP, KTC, contracts, seasonlogs, season-level projections, rankings, ESPN scores, team DVOA, PFF grades, format logs              |
| Single-week point-in-time | `single_nfl_week_id`   | scalar         | DFS salary, DFS ownership, practice designation, weekly projected market salary, betting game-prop markets, fantasy roster status |
| Multi-week aggregation    | `nfl_week_id`          | multi          | play-by-play stats, games played, player-teams history                                                                            |

`single_nfl_week_id` is the scalar counterpart of `nfl_week_id`. It stores as a one-element array and uses the same `ColumnParamNflWeekFilter` component in `single: true` mode. The server-side helper `resolve_single_nfl_week_id` in `libs-server/data-views/` extracts the scalar value with backward-compat fallback: `params.single_nfl_week_id` → `params.nfl_week_id[0]` → constructed from legacy `params.year` + `params.week` + `params.seas_type`.

#### `player_season_*` vs `player_week_*` naming

Fields that exist at both grains are split into explicit season and week variants. Projections expose six `player_season_projected_*` fields (keyed on `single_year`) and six `player_week_projected_*` fields (keyed on `single_nfl_week_id`). Rankings are season-only — six `player_season_*_ranking` fields keyed on `single_year`; the underlying `player_rankings_index` and `player_rankings_history` tables hold no week-level data and the week variant has been retired.

#### Projection `sourceid` param

The raw-stat projection columns (`player_{week,season,rest_of_season}_projected_{pass_atts,pass_yds,…,rec_tds}`) read per-source rows from `projections_index` (`ros_projections` for rest-of-season), which carries a row per projection provider. They accept a `sourceid` param selecting the provider, defaulting to `external_data_sources.AVERAGE` (the consensus) so a column with no `sourceid` is byte-identical to the pre-param behavior. The selectable set is the single source of truth `projection_data_source_ids` in `libs-shared/constants/source-constants.mjs`, surfaced in the UI by `projection_source_param` (`libs-shared/projection-source-column-param.mjs`). `sourceid` is part of the `projections_index` table-alias hash, so the same column requested twice with different sources resolves to two independent joins rather than collapsing into one.

The `points` columns (`player_{week,season,rest_of_season}_projected_points`) also accept the `sourceid` param: they are now **computed in-query** from the same `projections_index`/`ros_projections` rows (scored by the selected scoring format's weights) rather than joined from the precomputed `scoring_format_player_projection_points` table. This makes projected points honor the source picker and stay self-consistent with the raw-stat columns shown beside them. The scorer is inlined in `libs-server/data-views-column-definitions/player-projected-column-definitions.mjs` (`projection_fantasy_points_sql`) and faithfully implements `calculatePoints({ use_projected_stats: true })`: `projected_base_stats` × format weights, a position CASE for non-uniform reception formats, `+ xpm`, the field-goal distance buckets (`3·fg19 + 3·fg29 + 3·fg39 + 4·fg49 + 5·fg50`, never `fgy/10`), and the full DST block.

**`projections_index` AVERAGE is the authoritative source of truth, and the in-query value is the correct one.** `projections_index` is the live, as-of-gametime frozen consensus projection: it retains each settled week's real projection (validated against the per-source frozen `projections` history — e.g. Joe Flacco 2025 week 9 is `242.5` pass yds in `projections_index`, matching all ~10 sources; a week that reads `0`, like Ja'Marr Chase 2025 week 12, is a real bye/inactive, not a dropped row). The precomputed `scoring_format_player_projection_points` is a **per-format derived cache** that was regenerated independently and went **stale** for past formats/years — so wherever the two disagreed, the cache was wrong and the in-query value is right. (This corrects an earlier reading that the two were merely "independently-timed snapshots that drift" and that `projections_index` "zeroes out past weeks" — both inaccurate.) The pipeline now re-derives that cache **from** `projections_index` every run (`process-projections` → `process_scoring_format_year`, shared with the `process-projections-for-scoring-format` reconciliation backfill; never the reverse), so the cache and the in-query column stay in lockstep to within rounding across all formats/years. Validation: 2025 season week-0 AVERAGE/draftkings already matched **989/989, max diff 0.00**; the historical-weekly divergence (draftkings 2025: 10,395/18,791 rows, max 23.63) was the stale cache and is removed by the reconciliation. Non-degeneracy spot-check (production): for a season's actively-projected players (any non-zero base stat), in-query AVERAGE points are `> 0` and within a plausible range for ≥95% — measured 623/623 (100%) for 2024.

The other three computed projection columns (`points_added`, `market_salary`, `salary_adjusted_points_added`) are derived into `league_format_*`/`league_*` valuation tables that carry no `sourceid` dimension and do **not** accept the param. `ros_projections` selection is wired but currently inert — only the AVERAGE source is materialized there today.

#### Saved-View Migration

The `scripts/migrate-data-views-single-nfl-week.mjs` script performs column-scoped rewrites on `user_data_views.table_state` and `user_plays_views.table_state` rows:

1. Ranking column rename runs first: legacy `player_{avg,overall,position,min,max,std}_ranking` always renames to `player_season_*_ranking`; any week-related params (`week`, `seas_type`, `single_week`, `single_seas_type`, `single_nfl_week_id`, `nfl_week_id`) are stripped since rankings are season-only.
2. Single-week column consolidation: for the `SINGLE_WEEK_COLUMNS` set, legacy `year`/`week`/`seas_type` params collapse into a one-element `single_nfl_week_id` array.
3. Multi-week column consolidation: for the `MULTI_WEEK_COLUMNS` set, legacy params expand into a cross-product `nfl_week_id` array.

The same transformation runs in the browser on localStorage snapshot restoration via `app/core/data-views/browser-storage.mjs`, which imports the shared helper in `libs-shared/data-views-nfl-week-migration.mjs`. Saved views still carrying `year`/`week`/`seas_type` keys continue to resolve correctly on the server via the helper's fallback path, so the migration is non-breaking.

**NFL Week Parameter** (weekly column definitions):

- `nfl_week_id`: Composite identifier replacing separate year/week/seas*type. Format: `[YEAR]*[SEAS_TYPE]_WEEK_[WEEK]`(e.g.,`2024_REG_WEEK_5`). Maps to `nfl_week_id`column in database via`column_name: 'nfl_week_id'` property. Eliminates cartesian product problem when querying specific weeks across different years and season types. Values cover all years from 2000 to current season.
- `year_offset`: For year calculations (e.g., previous season comparisons). Applied during preprocessing to expand the nfl_week_id array.

**Dynamic nfl_week_id Values** (resolved at query time):

- `{ dynamic_type: "current_nfl_week" }` → Current NFL week identifier (e.g., `2024_REG_WEEK_5`)
- `{ dynamic_type: "last_n_nfl_weeks", value: 5 }` → Last 5 NFL week identifiers
- `{ dynamic_type: "last_n_nfl_years", value: 3 }` → All week identifiers for the last 3 NFL years
- `{ dynamic_type: "next_n_nfl_years", value: 1 }` → All week identifiers for the next 1 NFL year

**Centralized Preprocessing** (`resolve_nfl_week_params` in `get-data-view-results.mjs`):

1. Migrates legacy `params.nfl_week` to `params.nfl_week_id` for backward compatibility
2. Resolves dynamic nfl_week_id values to concrete identifier strings
3. Decomposes nfl_week_id array into `params.year`, `params.week`, `params.seas_type` (pre-offset base values for join function compatibility)
4. Applies `year_offset` expansion to produce final `params.nfl_week_id` array (post-offset, used for all WHERE clauses), and sets `params.year_offset_applied_to_nfl_week_id` to mark the list as already shifted

**Single-application invariant:** `year_offset` must be applied to a given `nfl_week_id` list exactly once. Step 4 bakes it into an explicit list and sets the `year_offset_applied_to_nfl_week_id` marker; view-scope resolution (`resolve-view-scope.mjs`) re-applies `year_offset` only to lists that lack the marker (year-derived and internally-built week lists, which arrive unshifted). Re-applying to an already-shifted list double-shifts the source window to `base + 2*offset` while the outer join shifts by only `1*offset`, silently dropping the bottom offset-cohort of base years (e.g. a 2020-rookie WR loses their 2021 next-year value).

**Season-Level Parameters** (retained for seasonlogs, ESPN scores, team seasonlogs):

- `year` / `single_year`: Array or single year, auto-uses partitioned tables for single years
- `week` / `single_week`: Array or single week within season
- `seas_type` / `single_seas_type`: Season type ('REG', 'POST', 'PRE')

**Legacy Dynamic Parameters** (for season-level columns):

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
- Determines optimal starting table via primary table analysis
- Coordinates pipeline stages for optimal processing order
- Manages CTE creation and reuse strategies
- Controls JOIN type selection for performance

**Key Decision Logic**:

```javascript
// From table optimization for performance
const from_table_config = get_from_table_config({
  sort,
  columns,
  prefix_columns,
  splits,
  data_views_column_definitions
})

// Initialize from the determined from table
if (from_table_config.from_table_name) {
  from_table_name = from_table_config.from_table_name
  players_query = db(from_table_name).select(`${from_table_name}.pid`)

  // Add early LEFT JOIN to player table for CTE-based from tables
  if (from_table_config.from_table_type === 'cte') {
    players_query.innerJoin('player', 'player.pid', `${from_table_name}.pid`)
  }
}

// Determines split strategy based on request
if (splits.includes('week') || splits.includes('year')) {
  const year_range = get_year_range([...prefix_columns, ...columns], where)
  // Creates base_years CTE for cross-join optimization
}
```

#### `add_clauses_for_table()` - Table Processing Core

**Performance-Critical Function**: Processes all columns and where clauses for a specific table, making key optimization decisions.

#### Join Control Parameters for Season-Level Data

Some columns contain season-level data (like `career_year`) that doesn't vary by week but should still support week splits for display purposes. These columns use specific join control parameters to prevent automatic week joins while maintaining week split compatibility:

```javascript
const player_seasonlogs_join = (join_arguments) => {
  return data_view_join_function({
    ...join_arguments,
    join_table_clause: `player_seasonlogs as ${join_arguments.table_name}`,
    additional_conditions,
    join_week: false, // Don't join on week since player_seasonlogs doesn't have week column
    skip_week_split_join: true // Skip automatic week join for week splits
  })
}
```

**Use Case**: Career year data is constant across all weeks in a season, but users want to see it when viewing data with week splits (e.g., "show me each player's career year for weeks 1-3 across multiple seasons").

**Function Signature**:

```javascript
async add_clauses_for_table({
  players_query,           // Main Knex query builder
  select_columns = [],     // Columns to select from this table
  where_clauses = [],      // Filter conditions for this table
  table_name,              // Target table name or alias
  group_column_params = {},// Shared parameters for optimization
  splits = [],             // Active split dimensions
  rate_type_column_mapping,// Column to rate type table mapping
  data_view_options,       // Query-level optimization flags with centralized references
  data_view_metadata       // Cache metadata tracking
})
```

**Internal Optimization Process**:

1. **Self-Join Prevention**: Skips joins when table matches the from table from from table optimization
2. **Clause Collection**: Groups select and where operations
3. **SQL Generation**: Calls column definition functions with optimization context
4. **JOIN Strategy**: Selects INNER vs LEFT JOIN based on filtering needs
5. **CTE Processing**: Handles WITH statement requirements efficiently
6. **Query Application**: Applies optimized clauses to query builder

**Self-Join Prevention Logic**:

```javascript
// Skip join entirely if this table is the same as the from table (prevents self-join)
if (table_name !== data_view_options.from_table_name) {
  if (join_func) {
    await join_func({
      query: players_query,
      table_name,
      params: group_column_params,
      join_type: where_clauses.length ? 'INNER' : 'LEFT',
      splits,
      data_view_options // Contains centralized references
    })
  }
} else {
  log(
    `Skipping self-join for table: ${table_name} (from table: ${data_view_options.from_table_name})`
  )
}
```

### Parameter Processing Functions

#### `process_dynamic_params(params)` - Dynamic Resolution

**Performance Impact**: Resolves dynamic parameters at query build time to enable optimization opportunities.

```javascript
// nfl_week_id preprocessing (called first via resolve_nfl_week_params):
{ nfl_week_id: [{ dynamic_type: "last_n_nfl_weeks", value: 3 }] }
// Becomes: { nfl_week_id: ["2024_REG_WEEK_5", "2024_REG_WEEK_4", "2024_REG_WEEK_3"] }
// Also sets: params.year, params.week, params.seas_type (decomposed base values)

// Season-level dynamic resolution (for columns without nfl_week_id):
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

### Centralized Reference System

**Core Architecture**:

The centralized reference system replaces individual `year_split_join_clause` and `week_split_join_clause` parameters with a unified reference system stored in `data_view_options`.

**Setup Phase**:

```javascript
// setup_central_references() sets up references based on from table
const setup_central_references = ({ data_view_options, splits }) => {
  const { from_table_name } = data_view_options

  // Setup player PID reference
  data_view_options.pid_reference = `${from_table_name}.pid`

  // Setup year and week references - use the from table directly
  data_view_options.year_reference = `${from_table_name}.year`
  data_view_options.week_reference = `${from_table_name}.week`

  return data_view_options
}
```

**Usage in Joins**:

```javascript
// Rate type joins using centralized references
players_query.leftJoin(rate_type_table_name, function () {
  this.on(`${rate_type_table_name}.pid`, data_view_options.pid_reference)

  // Year joins with offset calculations
  if (splits.includes('year')) {
    this.on(
      db.raw(
        `${rate_type_table_name}.year = ${data_view_options.year_reference} + ?`,
        [year_offset]
      )
    )
  }

  // Week joins
  if (splits.includes('week')) {
    this.andOn(
      `${rate_type_table_name}.week`,
      '=',
      data_view_options.week_reference
    )
  }
})
```

**Benefits**:

- **Consistent References**: All joins use the same year/week/PID references
- **From Table Adaptation**: References automatically adapt to from table optimization
- **Simplified Function Signatures**: No need to pass individual join clauses
- **Better Maintainability**: Single source of truth for all reference patterns

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

## Measure-First Column Contract

The two single-aggregate from-plays factories (`player-stats-from-plays-column-definitions.mjs` and `team-stats-from-plays-column-definitions.mjs`) declare each rate-capable column's per-row measure once, and `libs-server/data-views/measure-contract.mjs` (`derive_measure`) derives every downstream artifact from that single source of truth — the season-total render, the numerator measure expression the rate engine re-materializes, the period-CTE aggregate selector, the advertised `supports_output` periods, and the rounding. This replaced an earlier heuristic that parsed the season-render string to recover the measure and silently dropped rate types for `ROUND(SUM(...))`, `AVG(...)`, and `COUNT(DISTINCT ...)` shapes.

### The `measure` declaration

```javascript
measure: { kind: 'additive' | 'distinct_count', expr: '<sql>', decimals: <int|null> }
```

- `kind` is a closed set of two snake_case literals.
- `expr` is the per-row SQL fragment, scanned against `nfl_plays` in the numerator CTE (qualify ambiguous columns, e.g. `nfl_plays.esbid`, because that CTE joins `nfl_games`).
- `decimals` defaults `null`.

### Kind → behavior

| kind             | season render                                | numerator aggregate    | rate render                                      |
| ---------------- | -------------------------------------------- | ---------------------- | ------------------------------------------------ |
| `additive`       | `SUM(expr)`, or `ROUND(SUM(expr), decimals)` | `SUM(expr)`            | rounds iff `decimals` set                        |
| `distinct_count` | `COUNT(DISTINCT expr)` (always bare integer) | `COUNT(DISTINCT expr)` | `ROUND(.../games, decimals)`, decimals default 2 |

`decimals` semantics: `null` wraps neither season nor rate in `ROUND` (preserving exact parity for bare-`SUM` integer columns and today's unrounded rate emit). When set it rounds the additive season render and both kinds' rate render. The `aggregate` selector (`'sum'` | `'count_distinct'`) is spread onto the column-def and read by `build-period-cte.mjs` so a `count_distinct` numerator emits `COUNT(DISTINCT ...)` while co-locating in the same batched period CTE as `sum` measures.

### Carve-outs

Averages (`AVG(...)`, `CAST(ROUND(AVG(...)))`, `AVG(x)*100`), compound ratios (`CASE WHEN SUM>0 THEN ROUND(100.0*SUM/...)`), and `has_numerator_denominator` year-offset ratios are NOT routed through the deriver. They keep their raw `with_select_string` and declare `supported_rate_types: []` (an average has no meaningful per-period rate). The 8 `create_team_share_stat` columns are a separate factory, non-rate by construction.

### Fail-fast invariant

Scoped inside the two migrated factories: a column that advertises any rate type MUST declare a `measure`; a column left on a raw `with_select_string` MUST pass `supported_rate_types: []`. Violations throw at module load, making the silent-rate-drop regression class structurally impossible. The `role_attributions` / explicit-`supports_output` factories (defensive, fantasy-points) never call `derive_measure` and are exempt by construction — a global registry sweep would wrongly throw for them.

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
  data_view_options
}) => {
  if (splits.includes('year')) {
    // Split-aware join for time-series analysis
    players_query.leftJoin(rate_type_table_name, function () {
      this.on(`${rate_type_table_name}.pid`, data_view_options.pid_reference)
      this.on(`${rate_type_table_name}.year`, data_view_options.year_reference)
    })
  } else {
    // Simple join for aggregated analysis
    players_query.leftJoin(
      rate_type_table_name,
      `${rate_type_table_name}.pid`,
      data_view_options.pid_reference
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
    rate_type: config.rate_type,
    team_unit: config.team_unit,
    is_team: config.is_team,
    data_view_options // Contains centralized year_reference, week_reference, pid_reference
  })
}
```

### Rate Type SQL Generation

**Performance-Optimized Division Logic**:

```javascript
// Column definition main_select with rate type integration
main_select: ({
  column_index,
  rate_type_column_mapping,
  table_name,
  data_view_options
}) => {
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

// Year offset range handling with centralized references
main_select_string_year_offset_range: ({
  table_name,
  params,
  data_view_options
}) => {
  const min_year_offset = Math.min(...params.year_offset)
  const max_year_offset = Math.max(...params.year_offset)

  return `(SELECT SUM(${table_name}.fantasy_points) FROM ${table_name} 
    WHERE ${table_name}.pid = ${data_view_options.pid_reference} 
    AND ${table_name}.year BETWEEN ${data_view_options.year_reference} + ${min_year_offset} 
    AND ${data_view_options.year_reference} + ${max_year_offset})`
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
  data_view_options // Contains centralized year_reference, week_reference, pid_reference
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

// Join using centralized references
join_rate_type_cte({
  players_query,
  params: config.params,
  rate_type_table_name,
  splits,
  rate_type: config.rate_type,
  team_unit: config.team_unit,
  is_team: config.is_team,
  data_view_options // Contains centralized year_reference, week_reference, etc.
})
```

**Performance Benefits**:

- Eliminates redundant CTE calculation
- Reduces query complexity and parse time
- Enables PostgreSQL query plan optimization

### Team-Scoped Joins

**Problem**: Team-stat columns, rate-type `per_team_play` denominators, and rate-type `per_game` team denominators historically joined on `player.current_nfl_team`. This fails for (a) retired players (`current_nfl_team = 'INA'`), (b) historical queries where the player was on a different team, and (c) current-season queries for players traded mid/post-season (Stefon Diggs 2025 is the canonical repro).

**Solution**: A shared `player_year_teams` CTE (`pid → year → primary_team`) sourced from `player_gamelogs` joined to `nfl_games` where `seas_type = 'REG'`. Primary team per `(pid, year)` is selected by `(array_agg(tm ORDER BY game_count DESC, tm ASC))[1]` — most regular-season games, alphabetical tie-break.

**Registration**: the CTE and its outer-query LEFT JOIN are encapsulated in the `player_year` -> `team_year` identity bridge (`libs-server/data-views/identity-bridges/player-year-to-team-year.mjs`). Consumers invoke it via `apply_bridge({ query_context, from: 'player_year', to: 'team_year', params, source })` (`libs-server/data-views/identity-bridge-registry.mjs`). `apply_bridge` is idempotent — `query_context.applied_bridges` keys on `"<from>-><to>|<mode>"`, so the second call from a different consumer no-ops. The retired `historical-team-mode.mjs` module previously gated bridge attachment on `has_year_filter(params) || splits.length > 0`; that predicate was retired in `f13f8300` once the bridge became always-on for the contexts that invoke it (the consumer decides whether to invoke based on its own predicate — e.g., `rate-type-per-team-play.mjs` invokes when the subject identity is `player` and there is no `matchup_opponent_type`). Source-attach rules in `libs-server/data-views/source-attach/` invoke the bridge automatically when a `team_year`-shaped source attaches to a `player`-shaped cell.

**Year resolution** (`resolve_year_range` in `player-year-to-team-year.mjs`): the year range used to materialize the CTE and to pin the join's `year =` clause follows a 4-step fallback so the bridge is robust in offseason / source-attach contexts where `query_context.year_range` is empty:

1. `query_context.year_range` (year or week split present).
2. `params.year` (explicit per-column override).
3. `source.year_default(params)` (the attaching source's anchor year, e.g. ESPN team-stats defaults to `current_season.stats_season_year`).
4. `[current_season.year]` (defensive last resort).

Without step 3, attaching a `team_year` source on a player cell with no year split would have materialized `player_year_teams` for `current_season.year` (e.g. 2026 mid-offseason) and the source-attach join would find no rows, returning NULL for every active player.

**Outer-query join year** (`join_cte`): when a `year` split is active, the join binds on `query_context.year_reference` so each (pid, year) row binds to that row's year. Otherwise the join pins to `max(year_range)`. The multi-year-no-split case (where this pinning misattributes traded players' stats) routes through the wrap CTEs described above, which INNER JOIN `player_year_teams` on (pid, year) instead.

**Consumer sites** (non-exhaustive — every site that maps a player cell to a team-year scope routes through this bridge):

- `libs-server/data-views/rate-type/rate-type-per-team-play.mjs:join_per_team_play_cte` (and the wrap path in `per-team-play-wrap.mjs`).
- `libs-server/data-views/team-stats-from-plays-wrap.mjs` consumers (via `add_team_stats_play_by_play_with_statement.mjs`).
- `libs-server/data-views/source-attach/rules/player-family-to-team-year.mjs` (auto-attached team-year sources on player cells).
- `libs-server/data-views/output-aggregator/aggregator-rate.mjs` and `aggregator-count.mjs` (team-grain numerator/denominator joins for player subjects).
- `libs-server/data-views/data-view-join-function.mjs` (legacy team-stat column join entry).

Each site falls back to `player.current_nfl_team` only when the bridge is not applicable — typically when `matchup_opponent_type` is set (the column joins through the upstream opponents CTE) or when the subject identity is `team` (no player-to-team mapping needed).

**`team_attribution` param** (`'historical'` default | `'current'`): a per-column param that lets a view author choose which team a player-cell team RATE stat (`per_game`, `per_team_play`) attaches to, making explicit a semantic that was otherwise implicit-and-fixed. `'historical'` (default) is the bridge behavior above — the player's per-year team-of-record (`player_year_teams.team`). `'current'` attributes the stat to `player.current_nfl_team` (a forward-looking projection — a mover's NEW team's volume, e.g. a 2026 redraft view), skipping the bridge entirely. The param is read through one helper, `get_team_attribution(params)` in `resolve-team-join-target.mjs`, used at all three historical-bridge sites (the active resolver in `aggregator-rate.mjs`, the passive resolver in `resolve-team-join-target.mjs`, and the `requires_wrap` gate in `per-team-play-wrap.mjs`), so the two halves of a rate always resolve to the SAME team and the duplicated branch cannot drift (pinned by `test/data-views.team-attribution.spec.mjs`). Honored consistently across numerator, denominator, and the multi-year-no-split wrap (which `'current'` bypasses — there is no per-year team to reattribute when all volume goes to one team). Edge cases: a free agent (`current_nfl_team = 'INA'`) under `'current'` blanks both halves consistently (no last-team fallback — out of scope); a year-split under `'current'` repeats the single current-team snapshot across year rows (well-defined projection, not an error). Confined to the two rate types in v1; team-stats-from-plays COUNTING columns and the select-string year-offset branch do not declare it and are unchanged (deferred to `task/league/data-views/extend-team-attribution-to-counting-columns.md`). NOTE: because of the `data_view` socket cache-TTL-unit bug (`task/league/data-views/fix-data-view-socket-cache-ttl-unit.md`), a value change from flipping this param will not surface until the affected view's cache is manually invalidated/warmed.

**Defensive-unit reasoning**: `rate-type-per-team-play.mjs` uses a single join expression regardless of `team_unit` ('off' or 'def'). `player_gamelogs.tm` stores the player's own team; for defensive players that equals the defensive team on `nfl_plays.def`, so no branch is needed.

**Partition pruning**: the inner subquery applies `WHERE nfl_games.year IN (year_range) AND player_gamelogs.year IN (year_range)`. The second predicate is essential — `nfl_games.year` alone does not prune the `player_gamelogs` partitioned table.

**Coexistence with `teams` array_agg**: the `teams` aggregation in `rate-type-per-game.mjs:add_player_per_game_cte` (consumed by the `player_nfl_teams` column) is left untouched. It returns the full set of teams for multi-team display, while `player_year_teams.team` returns the deterministic primary team for joining.

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

### New Functions in Centralized Reference System

#### `setup_central_references({ data_view_options, splits })`

**Purpose**: Sets up centralized references for year, week, and player PID based on the from table.

**Parameters**:

- `data_view_options` (Object): Query optimization state object containing from table information
- `splits` (Array): Active split dimensions ['year', 'week']

**Returns**: Updated `data_view_options` object with centralized references

**Implementation**:

```javascript
const setup_central_references = ({ data_view_options, splits }) => {
  const { from_table_name } = data_view_options

  // Setup player PID reference
  data_view_options.pid_reference = `${from_table_name}.pid`

  // Setup year and week references - use the from table directly
  data_view_options.year_reference = `${from_table_name}.year`
  data_view_options.week_reference = `${from_table_name}.week`

  return data_view_options
}
```

#### `get_from_table_config({ sort, columns, prefix_columns, splits, data_views_column_definitions })`

**Purpose**: Determines the optimal from table configuration with whitelist-based rollout.

**Parameters**:

- `sort` (Array): Sort configuration from user request
- `columns` (Array): Column configurations
- `prefix_columns` (Array): Prefix column configurations
- `splits` (Array): Active split dimensions
- `data_views_column_definitions` (Object): Column definition registry

**Returns**: From table configuration object with `from_table_name`, `from_table_type`, and `column_id`

#### `setup_from_table_and_player_joins({ players_query, from_table_config, data_views_column_definitions })`

**Purpose**: Sets up the from table and required player joins for the query.

**Parameters**:

- `players_query` (Object): Knex query builder instance
- `from_table_config` (Object): From table configuration
- `data_views_column_definitions` (Object): Column definition registry

**Returns**: Void (modifies players_query in place)

### Core State Objects

#### `data_view_options` - Query Optimization State

```javascript
const data_view_options = {
  // Join tracking for performance
  opening_days_joined: false, // Prevents duplicate expensive joins
  player_seasonlogs_joined: false, // Tracks seasonlogs table usage
  nfl_year_week_timestamp_joined: false, // Week timestamp join tracking

  // From table optimization
  from_table_name: 'player', // Optimized starting table
  from_table_type: 'table', // Type of from table (table/cte)
  from_table_column_id: null, // Column ID that determined from table

  // Centralized references (replaces individual join clause parameters)
  pid_reference: 'player.pid', // Centralized player PID reference
  year_reference: 'player_years.year', // Centralized year reference
  week_reference: 'player_years_weeks.week', // Centralized week reference

  // Optimization state
  year_coalesce_args: [], // Year selection optimization
  rate_type_tables: {}, // CTE reuse tracking
  matchup_opponent_types: new Set() // Required opponent CTEs
}
```

**Performance Usage Patterns**:

- **Join Tracking**: Prevents expensive duplicate joins
- **CTE Management**: Enables reuse across columns
- **Centralized References**: Consistent year/week/PID joins across all tables
- **From Table Optimization**: Performance-optimized query starting points with whitelist system
- **Self-Join Prevention**: Automatic detection and prevention of invalid self-joins
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

#### `rate_type_column_mapping` (removed)

This mapping and its `get_rate_type_sql` emitter were the pre-output-aggregator rate-type dispatch. They became permanently dead once `normalize_output_param` began rewriting `params.rate_type` into `params.output` before any consumer ran (the mapping stayed `{}`, so every read yielded `undefined`). The declaration, its threading through `select-string.mjs` / `where-string.mjs` / the from-plays factories, and `get_rate_type_sql` were retired in the measure-first refactor. Rate output now flows exclusively through the output aggregator (`output-aggregator-registry.mjs` → the `rate-type/` plugins and `output-aggregator/`).

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

#### 1. Centralized Reference System (Implemented)

**Strategy**: Replace individual `year_split_join_clause` and `week_split_join_clause` parameters with centralized references stored in `data_view_options`.

```javascript
// Old system - parameters passed to each function
await add_clauses_for_table({
  players_query,
  year_split_join_clause: 'player_years.year',
  week_split_join_clause: 'player_years_weeks.week'
  // ... other params
})

// New system - centralized references
setup_central_references({ data_view_options, splits })
// Sets: data_view_options.year_reference, week_reference, pid_reference

await add_clauses_for_table({
  players_query,
  data_view_options // Contains all centralized references
  // ... other params
})
```

**Benefits Achieved**:

- **Reduced Parameter Passing**: Eliminated need to pass year/week join clauses to every function
- **Consistent References**: All joins use the same year/week references, preventing inconsistencies
- **Simplified Function Signatures**: Cleaner, more maintainable function interfaces
- **Better From Table Integration**: References automatically adapt to from table optimization
- **Automatic PID Reference**: Player PID reference adapts to from table automatically

**Implementation Details**:

- `setup_central_references()` determines optimal references based on from table and splits
- All join functions now use `data_view_options.year_reference` and `data_view_options.week_reference`
- Rate type CTEs automatically use centralized references for consistent joins
- Player PID reference adapts to from table optimization (`player.pid` vs `from_table.pid`)
- Function signatures updated across all rate type plugins and column definitions

#### 2. From Table Optimization with Whitelist System (Implemented)

**Strategy**: Start queries from the most selective table rather than always using `player` table, with gradual rollout using whitelist.

```javascript
// Determine optimal starting table from sort column and splits
const from_table_config = get_from_table_config({
  sort,
  columns,
  prefix_columns,
  splits,
  data_views_column_definitions
})

// Whitelist system for gradual rollout
const whitelisted_columns = new Set(['player_fantasy_points_from_plays'])

// Only use sort-based from table for whitelisted columns
if (
  sort_based_from_table.from_table_name &&
  sort_based_from_table.column_id &&
  whitelisted_columns.has(sort_based_from_table.column_id)
) {
  return sort_based_from_table
}

// Fall back to default from table setup for non-whitelisted columns
return setup_default_from_table(splits)
```

**Impact Achieved**:

- Reduced query execution time from 30+ seconds to under 5 seconds for whitelisted columns
- Starting result set reduced from ~27K records to 1-5K records
- Eliminated redundant self-joins through prevention logic
- Improved PostgreSQL query plan selection
- Safe gradual rollout with whitelist system

**Implementation Details**:

- `determine_from_table()` analyzes first sort column for CTE vs regular table
- `get_from_table_config()` applies whitelist and fallback logic
- `setup_from_table_and_player_joins()` handles setup for all table types
- Self-join prevention in `add_clauses_for_table()` avoids invalid SQL
- Centralized references automatically adapt to chosen from table

#### 3. Query Plan Caching

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

#### 4. Lazy Column Evaluation

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

#### 5. Batch Rate Type Processing

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

## Year Pushdown Contract for CTE-Based Columns

The contract below applies to every CTE builder backing a data-view column -- both the rate-type denominator CTEs in `libs-server/data-views/rate-type/` and the stat-column CTEs in `libs-server/data-views/add-*-play-by-play-with-statement.mjs` plus the inline `with:` handlers on `player-fantasy-points-from-plays-column-definitions.mjs` and the `create_team_share_stat` factory in `player-stats-from-plays-column-definitions.mjs`.

Every such builder that scans a year-partitioned table MUST apply `effective_years` as a `WHERE ... IN (...)` predicate on every such table it scans, whenever `effective_years` is known from any source:

- Column-level `params.year` (routed through `resolve_nfl_week_id_from_year_param`)
- `nfl_week` decomposition via `decompose_nfl_weeks`
- Split-driven `data_view_options.year_range`

`effective_years` is the sorted union of `all_years` (derived from `nfl_week` decomposition) and `data_view_options.year_range`. When non-empty, builders push it onto every year-partitioned table touched by the CTE (for example `nfl_plays`, `nfl_snaps`, `nfl_plays_receiver`, `player_gamelogs`, `nfl_games`). Without this predicate the planner reads every year partition even when the outer query restricts the year axis.

Column definitions that call a rate-type `add_*_cte` function or a stat-column `with:` handler MUST forward `data_view_options` into the call; the builder depends on `data_view_options.year_range` to compute `effective_years` for the split-driven case. Omitting it silently disables year pushdown for any column whose year signal comes only from splits. For UNION-ALL subqueries (see `add-defensive-play-by-play-with-statement.mjs`), push the predicate inside each inner `FROM nfl_plays` branch rather than on the outer wrapped subquery -- outer-query filters do not reach partition-pruning time.

## Materialization Policy for CTE-Based Columns

Every aggregation CTE built by a column's `with:` handler -- rate-type denominator CTEs and stat-column CTEs alike -- is registered via `withMaterialized`, not `with`. PostgreSQL 12+ inlines non-recursive CTEs referenced once, and with small outer-join cardinality the planner picks nested-loop plans that re-execute the CTE body hundreds of times (measured: 114x re-execution of the `player_receiving_yards_after_catch_from_plays` stat CTE on a year-split view consumed roughly 6 seconds of a 7.9 second baseline).

Because every rate predicate is pushed at CTE construction time (see the Year Pushdown Contract above), planner predicate push-into-CTE is not needed. `withMaterialized` defeats that inlining and preserves the partition-pruning behavior we rely on.

Split CTEs (`base_years`, `player_years`, `player_years_weeks`) stay inlineable -- they are small and the planner handles them well.

## NFL Week Encoding Invariants

`nfl_week_id` identifiers follow the shape `{year}_{seas_type}_WEEK_{week}` with `seas_type` in `{PRE, REG, POST}`. The REG max week is era-dependent, not a flat constant:

| Year range    | REG max week |
| ------------- | ------------ |
| pre-1978      | 14           |
| 1978-1989     | 16           |
| 1982 (strike) | 9            |
| 1987 (strike) | 15           |
| 1990-2020     | 17           |
| 2021+         | 18           |

Postseason rounds are always encoded as `{year}_POST_WEEK_{1..4}` (Wild Card / Divisional / Conference / Super Bowl). The era map is inlined in `libs-shared/nfl-week-identifier.mjs` (`REG_MAX_WEEKS_BY_ERA`) and resolved via `get_max_weeks_for_season_type({ seas_type, year })`. Calling the resolver with `seas_type: 'REG'` but no `year` returns `0` (fail-loud).

`practice` enforces a blanket `CHECK (NOT (seas_type='REG' AND week > 18))` at the DB level. The CHECK is intentionally era-blind because historical data already conforms and all going-forward writers cap REG at 18; an era-aware CHECK would require a trigger.

Writers that touch week-scoped rows in tables lacking a source-driven `seas_type` column (for example `practice`) must derive `seas_type` explicitly from `current_season.nfl_seas_type` on INSERT. The `DEFAULT 'REG'` on those columns has been dropped so omitting `seas_type` now raises a NOT NULL violation instead of silently misencoding postseason rows as REG.

### Live current_season semantics

`current_season.week` is the **continuous counter** from `regular_season_start` (week 1 = first REG game week, increments through the Super Bowl). `current_season.nfl_seas_week` **resets to 1** at the start of POST. These are NOT interchangeable; every `nfl_week_id` default must branch on `current_season.nfl_seas_type`.

Canonical helpers live in `libs-shared/nfl-week-identifier.mjs`:

- `current_nfl_week_params()` → `{year, seas_type, week}` with POST using `nfl_seas_week`, REG using `week`, year from `stats_season_year`.
- `current_nfl_week_identifier()` → formatted `nfl_week_id` string.
- `nfl_week_offset_params({ offset })` → canonical triple for a negative offset, honoring the REG↔POST boundary. Returns `null` when stepping before REG week 1 of the current year. Throws on positive offsets.
- `reference_week_fallback_params()` → `{ prior_params, fallback_params }` (or `null`). Used by reserve / gamelog reference-week joins that need a one-week bye fallback; `fallback_params` is two-weeks-prior when it exists, else `prior_params`.

Server code must never reconstruct identifiers locally. Column-def "current" fallbacks choose one of two choke-points:

- `resolve_single_nfl_week_id({ params })` — always resolves. Resolution order: `single_nfl_week_id` → `nfl_week_id[0]` → legacy `year` + `week` (+ `seas_type`) → legacy `year`-only (returns the most meaningful REG week for that year via `last_meaningful_reg_week_params_for_year`: era-max REG week for past years, current REG week during live REG, era-max REG week during live POST, REG week 1 during PRE/offseason) → `current_nfl_week_identifier()`. Used by inherently week-scoped columns.
- `resolve_single_nfl_week_id_if_explicit({ params })` — returns `null` unless `single_nfl_week_id` or a non-empty `nfl_week_id` was explicitly provided. Empty arrays count as "not set". Used by columns whose behavior differs between season-level and week-level queries (betting-market props, roster-status).

Column-def `get_params` must not branch on `nfl_seas_type`.

Current-week joins go through shared helpers:

- `apply_practice_current_week_join({ db, query, ... })` — `libs-server/data-views/join-practice-current-week.mjs`
- `apply_nfl_games_current_week_join({ db, query, team_column })` — `libs-server/data-views/join-nfl-games-current-week.mjs`. Emits strict equality on `(year, seas_type, week)`; no `OR IS NULL` branch.
- `apply_nfl_games_offset_week_join({ db, query, offset, alias })` — `libs-server/data-views/join-nfl-games-offset-week.mjs`

Direct `joinRaw` / inline `where('seas_type', 'REG')` fragments on week-keyed tables are disallowed for the current-week and prior-week patterns. Season-aggregate REG conventions (season-level rankings `week=0`, PFR/ESPN REG-only published stats, "primary team by REG game count") remain REG-only by product convention.

## OBJECT_PRESET Data Type

The `OBJECT_PRESET` data type (`TABLE_DATA_TYPES.OBJECT_PRESET = 9`, formerly `PERSONNEL_GROUP`) is a multi-column conjunctive filter for value-object presets such as offensive and defensive personnel packages. Used by the `off_personnel` and `def_personnel` column params in `libs-shared/nfl-plays-column-params.mjs`. The data type is generic in `react-table`; football-specific key whitelisting lives in `libs-shared/validators/personnel-group.mjs`.

### Value Shape

The where-clause value is an array of plain objects. Each object is a conjunction across one or more position counts; the array itself is a disjunction (OR) of those conjunctions.

```js
;[
  { rb: 1, te: 1, wr: 3 },
  { rb: 1, te: 2, wr: 2 }
]
```

Translates to:

```sql
WHERE (
  (off_personnel_rb_count = 1 AND off_personnel_te_count = 1 AND off_personnel_wr_count = 3)
  OR
  (off_personnel_rb_count = 1 AND off_personnel_te_count = 2 AND off_personnel_wr_count = 2)
)
```

Keys absent from a value object are not constrained. This lets defensive presets like Nickel (`{ db: 5 }`) match without imposing DL/LB constraints.

### Param Definition

Each OBJECT_PRESET param specifies:

- `column_specs`: array of `{ key, column, label, min, max, advanced? }` mapping object keys to physical columns and providing UI bounds.
- `preset_values`: array of `{ label, value, n }` describing common packages with row-count annotations for tooltip display.

### Backing Columns

Authoritative columns (parsed from the NFL-feed `off_personnel` / `def_personnel` strings):

- `off_personnel_qb_count`, `off_personnel_rb_count`, `off_personnel_te_count`, `off_personnel_wr_count`, `off_personnel_ol_count`
- `def_personnel_dl_count`, `def_personnel_lb_count`, `def_personnel_db_count`

PlayerProfiler-source columns (preserved snap-classification counts, not used by the filter):

- `off_personnel_rb_count_pp`, `off_personnel_te_count_pp`, `off_personnel_wr_count_pp`

Per-partition composite indexes cover `(off_personnel_rb_count, off_personnel_te_count, off_personnel_wr_count)` and `(def_personnel_dl_count, def_personnel_lb_count, def_personnel_db_count)`.

### Discrepancy Log

A one-time migration diagnostic table `personnel_count_discrepancies` captures rows where the parser disagreed with a pre-existing authoritative count value. Not written by ongoing imports. May be dropped after post-deployment verification confirms no investigation is needed.

### Operator

OBJECT_PRESET supports `IN` only. The structural validator (`react-table/src/validators/security-patterns.mjs`) accepts the array-of-objects shape generically (integer values, bounded range). Domain-specific key whitelisting (e.g. football positions) is layered on top via `create_object_preset_validator({ allowed_keys, value_max })` exported from `react-table` and consumed by `libs-shared/validators/personnel-group.mjs`.

## Param Option Counts

The param option counts endpoint provides live row-count previews for `OBJECT_PRESET` filter chips, replacing static `n` annotations with values that reflect the user's other active filters.

### Endpoint Contract

`POST /data-views/param-option-counts`

Request body:

```json
{ "table_state": { "where": [ ... ] }, "target_param_name": "off_personnel" }
```

Response:

```json
{
  "counts": { "rb:1,te:1,wr:3": 12345, "rb:1,te:2,wr:2": 6789 },
  "generated_at": "<iso>"
}
```

Keys are canonical signatures from `serialize_preset_value({ ... })` (sorted-key `k:v` joined by `,`). Values are unfiltered `COUNT(*)` over `nfl_plays` after applying every active `nfl_plays_column_params` predicate from `table_state.where[*].params` _except_ the targeted param.

### Cache Policy

The endpoint caches via `redis_cache` at TTL 600 seconds, keyed by `param-option-counts:${target_param_name}:${get_stats_column_param_key({ params: other_params })}`. Server-side `statement_timeout` is 10 seconds; on timeout or any query failure the endpoint returns `{ counts: {} }` so the UI degrades silently to the static `n` defaults retained on the column-param definition.

### `counts` Prop Contract

`column-param-object-preset-filter` accepts an optional `counts` prop: a `{ [signature]: number }` map. When provided, each preset chip renders the live count in place of its static `preset.n`; absent or missing-key entries fall back to the static `n`. The `filter-controls-column-param-item` dispatcher passes `counts` through.

### Client Pipeline

1. `app/core/data-views/sagas.js` debounces `DATA_VIEW_CHANGED` (250ms), computes a stable signature of active `nfl_plays_column_params` keys + values across `table_state.where[*].params`, and forks one `fetch_param_option_counts` per active param when the signature changes.
2. The reducer at `app/core/data-view-request/reducer.js` stores results under `param_option_counts[param_name][signature] = count`. The `DATA_VIEW_RESULT` reducer path does not dispatch `DATA_VIEW_CHANGED`, preventing fetch -> result -> fetch feedback.
3. `get_enriched_data_views_fields` in `app/core/selectors.js` overlays live counts onto each `column_param_definition.preset_values[*].n` for OBJECT_PRESET params, then feeds the enriched fields to `<Table all_columns={...} />`.

## Notices and Filter Chips

The player-centric data-views page renders two client-only surfaces below the table's view controller (the search/controls row with Columns / Filter / Splits) and above the column headers, to make filter scope legible and to flag likely misconfigurations. They live in `react-table`'s `Table.controls_extension` slot, so they share the same sticky-left alignment as `table-quick-filters`.

### Filter chip strip

`<DataViewFilterChips>` renders one rectangular chip per active filter. Each chip's label is `column operator value - scope` (e.g. `Targets >= 100 - 2025 REG`); the scope segment is omitted when the filter has no time-scoped params. Clicking any chip opens the filter-controls panel (it does not focus a specific filter). The chip open path bypasses `add_where_params_from_columns` injection that `react-table`'s `TableFilterControls.handle_menu_toggle` runs when its own toggle is clicked -- intentional in v1: a chip click is "inspect existing filters", not "seed new ones".

State plumbing: the panel's open/close state lives in `DataViewsPage` (`useState`) and is passed to both `<Table>` (controlled props `filter_controls_open` / `set_filter_controls_open` on `react-table`'s `Table`) and `<DataViewFilterChips>`. When the panel opens with filters present, `TableFilterControls` collapses the "Available Filters" tree once per open transition (ref-gated) so the user lands on "Selected Filters" without fighting later manual expansion.

### Notices

Below the chip strip, `<DataViewNotices>` renders soft-blue info notices (severity = info, inline SVG glyph, no MUI Alert) for any items emitted by the client selector `get_data_view_notices`. Each notice is dismissible per session via local `useState`; the container returns `null` when empty.

Current notice codes:

| Code                                       | Trigger                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter_param_key_absent_from_columns`     | A filter declares a param key (e.g. `nfl_week_id`, `scoring_format_hash`) that no active display column uses.                                      |
| `filter_param_value_disjoint_from_columns` | Both filter and column carry the same param key, but the filter's resolved value set is fully disjoint from every column's value set for that key. |

Rule #2 includes a minimal client-side resolver for the `nfl_week_id` `dynamic_type` values that `process_dynamic_params` handles server-side (`current_year_reg_weeks`, `current_nfl_week`, `last_n_nfl_weeks`, `last_n_nfl_years`); other dynamic types skip the check rather than risk false positives.

### File map

| File                                              | Role                                                          |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `app/core/data-views/format-param-scope.mjs`      | Pure formatter shared by chips and notices                    |
| `app/core/data-views/active-filter-summaries.mjs` | Selector input -> chip-shaped summaries                       |
| `app/core/data-views/data-view-notices.mjs`       | The two notice rules, concatenated by `get_data_view_notices` |
| `app/views/components/data-view-filter-chips/`    | Chip container + view + styles                                |
| `app/views/components/data-view-notices/`         | Notice container + view + styles                              |

### Adding a third notice

Add another `find_*` function inside `data-view-notices.mjs` and concat its output in the exported selector. Promote to a registry only at three rules (rule of three).

## Related Documentation

### Schema and Validation

- **[Data View Request Schema](./data-view-request-schema.json)** - Complete JSON schema for API requests
- **[Performance Guidelines](./data-view-specs/performance-guidelines.json)** - Performance optimization rules and recommendations
- **[Parameter Compatibility](./data-view-specs/validation/parameter-compatibility.json)** - Parameter validation and compatibility matrix
- **[Specs Index](./data-view-specs/index.json)** - Master index of all specification files

### Implementation Details

- **Source/Bridge Architecture** — canonical reference for the source descriptor schema, identity-bridge and source-attach registries, dispatcher contract, rule-family coverage, and recipes for extending the system. Lives in user-base at `text/league/data-views/source-bridge-architecture.md`.
- **[Fantasy Points Column Definition](./fantasy-points-column-definition.md)** - Comprehensive real-world column implementation example
- **[Query Builder Function Reference](./query-builder-function-reference.md)** - Complete function documentation with parameters and usage

### User Documentation

- **[Data Views User Guide](./guides/data-views.md)** - Step-by-step guide for creating and using data views
- **[Named Formats](./named-formats.md)** - Documentation of available scoring and league formats

### Column Specifications

- **[Column Families](./data-view-specs/column-families/)** - Organized specifications by functional group
- **[Parameter Schemas](./data-view-specs/parameters/schemas/)** - Reusable parameter definitions
- **[Parameter Values](./data-view-specs/parameters/values/)** - Enumerated values for common parameters

### Development Resources

- **[API Documentation](./api-documentation.md)** - Complete API endpoint documentation
- **[Adding New Fantasy Statistics](./adding-new-fantasy-statistics.md)** - Guide for extending the system
- **[Database Index Naming](./database-index-naming.md)** - Database performance optimization guidelines
