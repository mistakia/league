# Data Views System: Query Builder and Column Architecture

This document provides comprehensive documentation of the data views system, focusing on the internal query builder architecture to help developers understand the current implementation for performance improvements and extensions.

For the structural primitives the query builder is composed of — row-grain identities, identity bridges, the source-attach registry, the column contract, and the output-aggregator registry — see [Data Views Architecture](./data-views-architecture.md). That document covers what the pieces are and how to add one; this one covers how a request flows through them and the operational contracts they must honor.

**Retired primitives.** The following no longer exist anywhere in `libs-server/`; if you find one named in a doc, a comment, or a plan, it is stale:

| Retired                                                                     | Replaced by                                                |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `is_team` column-definition flag                                            | `is_team_identity(identity_id)` in `identities.mjs`        |
| `supported_splits` / `supports_splits`                                      | `supported_row_axes` plus grain reachability               |
| `supported_rate_types`                                                      | `supports_output.periods`, derived from the subject grain  |
| `supports_periods` as a hand-set field                                      | `measure/capability.mjs`, keyed on the subject grain       |
| `measure: { kind, expr }`                                                   | `measure: { accumulators, combine_accumulators }`          |
| `numerator_select` / `denominator_select` / `has_numerator_denominator`     | two accumulators plus a combine that divides               |
| `is_rate` / `rate_with_selects` / `has_numerator_denominator_pair`          | the same, on the team factory                              |
| `requires_numerator_denominator_in_year_offset`                             | `accumulator_columns` on the column definition             |
| `is_percentage`                                                             | the combine writes its own scale                           |
| `create_team_share_stat`                                                    | the `plays_cohort` fact source                             |
| `rate_type_tables`                                                          | `query_context.applied_output_ctes`                        |
| `get_rate_type_cte_table_name` / `add_rate_type_cte` / `join_rate_type_cte` | the output-aggregator plugin interface                     |
| `rate_type_handlers` dispatch map                                           | `output-aggregator-registry.mjs`                           |
| `setup_central_references`                                                  | `resolve_references` in `identities.mjs`                   |
| `is_historical_team_mode`                                                   | the `player_year` to `team_year` identity bridge           |
| `join_on_team` / `data-view-join-function.mjs`                              | column `source` descriptors and the source-attach registry |
| `subjects` / `splits` vocabulary                                            | `row_grain` / `row_axes`                                   |

The `rate_type` **request** param is not retired and never will be — shared short URLs carry it permanently, and `normalize-output-param.mjs` translates it to `output` on the way in.

## Table of Contents

1. [System Overview](#system-overview)
2. [Query Building Pipeline](#query-building-pipeline)
3. [Column Definition Architecture](#column-definition-architecture)
4. [Request Schema and API](#request-schema-and-api)
5. [Core Functions and Processing](#core-functions-and-processing)
6. [Table Grouping and Split System](#table-grouping-and-split-system)
7. [Measure-First Column Contract](#measure-first-column-contract)
8. [Output Aggregation](#output-aggregation)
9. [Performance Optimization Strategies](#performance-optimization-strategies)
10. [State Management and Data Flow](#state-management-and-data-flow)
11. [Error Handling and Edge Cases](#error-handling-and-edge-cases)
12. [Performance Improvement Opportunities](#performance-improvement-opportunities)
13. [Sandboxed SQL Tier](#sandboxed-sql-tier)
14. [Related Documentation](#related-documentation)

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

**Historical-Team Joins for `per_team_play` Denominators**: `period-denominator/per-team-play.mjs` attributes the team-aggregated denominator (`per_team_pass_play`, `per_team_rush_play`, etc.) to the player's team-of-record per (pid, year) via the `player_year_teams` bridge CTE (materialized by the `player_year` -> `team_year` entry in `identity-bridge-registry.mjs`). Three branches share that bridge:

1. **Single-year snapshot join** (single `params.year`, or row_axes include `year` resolving to one year, no `year_offset` range): `join_per_team_play_cte` joins the denominator on `player_year_teams.team` with `andOn(rate_type_table_name.year = <specific_year>)`. The bridge's own `join_cte` pins `player_year_teams` to `max(year_range)`, which for the single-year case is that year. Denominator CTE is grouped by `off` only.
2. **Year-split per-(pid, year) row grain** (`row_axes.includes('year')`): the denominator CTE adds `nfl_plays.season_year` (aliased `year`) to its select and group-by so each (off, year) cell is addressable; the join binds `rate_type_table_name.year = data_view_options.year_reference`. Attribution is structural to the row grain — no wrap needed because each output row already carries its own year.
3. **Multi-year-no-split wrap CTE** (`requires_wrap` in `per-team-play-wrap.mjs`: player subject, 2+ distinct effective years, no `year` split, no `matchup_opponent_type`): `add_per_team_play_cte` is invoked with `force_year_grain=true` so the denominator is grouped by `(off, year)`. `join_cte` then registers a per-column wrap CTE (`flush_per_team_play_wraps` materializes it after `flush_measure_batches`) that recomputes the numerator at (pid, year) grain inline, INNER JOINs `player_year_teams` on (pid, year) and the denominator on (team, year), then groups back to pid. The outer query LEFT JOINs the wrap on pid and divides `MAX(numerator_sum) / NULLIF(MAX(denominator_sum), 0)`. Without the wrap, a player who changed teams (Davante Adams: LV/2023 -> NYJ/2024 -> LA/2025) would have his multi-year stats divided by a single `max(year_range)` team's count; players with no row for `max(year_range)` would return NULL even when they accumulated stats in prior years.

**Team `per_game` denominator grain**: `period-denominator/per-game.mjs`'s `add_team_per_game_cte` counts games per team from `nfl_games` (home/away `UNION ALL` → `COUNT(*)`) and partitions by `year` **only when a year split is active**, matching `build-period-cte`'s `include_year` invariant (and the player per-game denominator). Unsplit, this is one row per team (full-window game count, ~team-invariant: 51 over 2023-2025 REG); under a year split it is one row per `(team, year)` for a year-correlated 1:1 join. Grouping by year unconditionally fans the denominator into `(team, year)` while the numerator stays a full multi-year total, so the outer `MAX()` collapses to a single season's game count and inflates every team per-game rate by ~N (years in window) — the 2026-06-20 grain bug (commit cbcfb8c4). Residual: the `per_game` team path still joins its numerator via `player_year_teams` (2025 team) but its denominator on `player.current_nfl_team`; post-fix the denominator is team-invariant so the only effect is that an offseason team-changer's displayed team volume reflects their 2025 team, not their new team (unlike `per_team_play`, which routes both through `identity_bridge_registry`).

**Historical-Team Joins for `team_*_from_plays` Columns**: `team-stats-from-plays-wrap.mjs` applies the same three-branch shape to the team-variant of `team_*_from_plays` columns (e.g. `team_pass_yards_from_plays` on a player view, `force_player_active=false`). The wrap-mode predicate (`requires_team_stats_wrap`) is symmetric to `per_team_play`'s: player subject, multi-year effective scope, no `year` split, no `week` split (a week split would fan the pid-grain wrap across every per-week row), no `matchup_opponent_type`. In wrap mode the base `_team_stats` CTE in `add_team_stats_play_by_play_with_statement` is promoted to `(nfl_team, year)` grain and the wrap CTE re-keys it on pid via `player_year_teams`; in the single-year and year-split branches the standard `nfl_team`-keyed shape is retained. The `_player_team_stats` variant (`force_player_active=true`) is exempt because it already keys on pid through its internal `player_gamelogs` join. The shared `requires_wrap` predicate inputs (effective-year resolution via `compute_effective_scope`, matchup-param extraction) live in `libs-server/data-views/wrap-predicates.mjs` so both modules consume one definition. Wrap-mode decisions are memoized on `query_context.team_stats_wrap_decisions` so `compute_effective_scope` is not re-run per column.

## Column Definition Architecture

### Standard Column Definition Structure

```javascript
{
  // Core identification
  table_name: 'player_gamelogs',          // Primary database table
  column_name: 'rec_yds',                 // Database column name

  // Query generation functions (performance-critical)
  main_select: ({ column_index, params, table_name, rate_type_column_mapping, row_axes, data_view_options }) => [
    {
      sql: `SUM(${table_name}.rec_yds) as receiving_yards_${column_index}`,
      bindings: []
    }
  ],

  main_where: ({ table_name, params, case_insensitive }) => {
    // Return SQL WHERE clause string
    return `${table_name}.primary_position = ?`
  },

  main_group_by: ({ table_name, column_index }) => [
    `${table_name}.pid`
  ],

  // Performance optimization functions
  table_alias: ({ params, row_axes }) => {
    // Use year-specific partitioned tables when possible
    if (params.year?.length === 1) return `player_gamelogs_${params.year[0]}`
    return 'player_gamelogs'
  },

  join: async ({ query, table_name, params, join_type, row_axes, data_view_options }) => {
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
  supported_row_axes: ['year', 'week'],
  supports_output: { periods: ['game', 'season', 'team_play'], aggregations: ['rate', 'count'] },
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
        'nfl_plays.possession_nfl_team',
        db.raw('SUM(nfl_plays.rush_yards) as rushing_yards'),
        db.raw('COUNT(*) as play_count')
      ])
      .from('nfl_plays')
      .where('nfl_plays.play_type', 'RUSH')
      .groupBy('nfl_plays.possession_nfl_team')

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
  row_axes: Array<SplitType>,              // Time grouping ('year', 'week')
  offset: Number,                         // Pagination offset
  limit: Number                           // Result limit (max 500)
}
```

### Saved View Access Model

The three saved-view read routes are deliberately asymmetric, and the asymmetry is the security model:

- `GET /data-views` requires auth and returns **only the caller's own views** — with one deliberate, server-side exception: the admin account (`userId === 1`, the same check `/data-views/debug` and the cache routes use) may list every saved view on the platform for audit and triage. The route takes no filter parameters, because any parameter that selects another user's views re-opens platform-wide enumeration; the admin exception widens nothing in the request surface, since it is decided server-side from the token. Until 2026-07-31 it had neither an auth check nor a mandatory filter, so an anonymous caller could retrieve every saved view on the platform along with its name, description and `table_state`.
- `GET /data-views/:view_id` and `POST /data-views/search` are unauthenticated by design. An unguessable `view_id` is what makes a view shareable, and a short URL (`/u/{hash}`) resolves through `search` alone. Requiring auth on either would break every link already sent.

That combination only holds while the list route cannot enumerate ids for non-admin callers. Do not add a filter parameter back to it. Note these routes mount before the blanket auth guard in `api/index.mjs`, so each one must self-enforce.

### Viewer-Scoped Columns

Most columns answer the same thing for everyone. A few cannot: `player_league_roster_tag` and `player_league_roster_status` carry a league's restricted free agency tags, which are private to the team holding them until the nomination is announced. Those columns declare `is_viewer_scoped: true` and read the caller's identity from `data_view_options.viewer_user_id`.

Identity enters at one point per transport and is never client-supplied — `req.auth.userId` on the HTTP search and export routes, the socket's own `user_id` on the websocket — and reaches the engine as `get_data_view_results({ user_id })`. The websocket applies it _after_ spreading the client's `params`, so a crafted request cannot name its own viewer.

The result cache is what makes this delicate. `/data-views/<hash>` is one key namespace shared by the search route, the export route and the socket, and `get_data_view_hash` has always keyed on the table state alone. A viewer-dependent answer cached under a viewer-independent key would serve the first requester's rows to everyone, so the hash now folds the viewer in — but **only** when the table state names a column in `viewer_scoped_column_ids` (`libs-server/data-views/viewer-scoped-columns.mjs`). Every other view keeps the key it has always had, so nothing was invalidated and ordinary views lose no hit rate.

Two rules for adding another one. `get_data_view_hash` takes `user_id` as a **required** argument and throws on `undefined` — a caller that could silently omit it would write an authenticated result under the anonymous key, which is the leak this design exists to prevent, so pass an explicit `null` for anonymous. And add the column id to `viewer_scoped_column_ids` alongside the flag: `test/data-views.viewer-scoped-columns.spec.mjs` asserts the set and the flagged definitions match exactly, so the two cannot drift.

Note what a gated column must emit for a hidden value. `player_league_roster_tag` renders a hidden restricted free agency tag as `regular`, not as `NULL` — `NULL` already means "not rostered", so a third outcome would identify the tagged player exactly as well as the tag itself. The gate applies to `main_select`, `main_group_by` and `main_where` together; a `WHERE` that bypassed it would let a caller enumerate hidden tags by filtering for them.

**Before gating a column, check whether the branch that differs by tag is itself correct — a leak here is often a projection bug, and gating it would preserve the wrong number behind an access check.** Any column whose SQL branches on a private field is a disclosure channel even when it never names the field: `player_league_extended_salary` had a tag-4 arm returning the stored salary while every regular contract took a ladder adding at least $5, so `extended_salary = player_league_salary` held for a tagged player and for no other, and differencing two public columns recovered the hidden tag exactly. The fix was not a third viewer-scoped column. `scripts/process-extensions.mjs` is the writer of record for that charge and coerces the tag to REGULAR before pricing, so the arm projected a number production never charges; deleting it fixed the projection and closed the channel at once, with no cache sharding and no figure that is wrong for non-owners. Find the writer of record for the quantity before deciding a reader's per-viewer difference is intended — and note this window was live only between roster rollover and `extension_deadline_at`, so an emitter can be provably leak-free on today's data and still leak annually. Prefer pinning the property in a test (`test/tag-board.spec.mjs` asserts tag 4 and tag 1 price identically) over a comment, so a future arm cannot silently reopen it.

### Column Configuration Patterns

```javascript
// Simple column (performance-optimal)
"player_position"

// Parameterized column with rate type
{
  column_id: "player_fantasy_points_from_plays",
  params: {
    year: [2023, 2024],                   // Multi-year for trends
    nfl_week_id: [                        // Week scope (see note below)
      "2024_REG_WEEK_1",
      "2024_REG_WEEK_2"
    ],
    scoring_format_hash: "half_ppr",      // Named format (auto-resolved)
    rate_type: ["per_game"]               // Statistical normalization
  }
}

// Dynamic parameters (resolved at query time)
{
  column_id: "player_rushing_yards_from_plays",
  params: {
    year: { dynamic_type: "last_n_years", value: 3 }     // Last 3 seasons
  }
}
```

**On the `*_from_plays` path, `nfl_week_id` is the canonical week param — not `week`.**
`week` was a member of `nfl_plays_column_params` until `64a28f9dc` replaced it with the
composite `nfl_week_id`, whose values are `<year>_<PRE|REG|POST>_WEEK_<n>` identifier
strings (`libs-shared/nfl-week-identifier.mjs`), not bare week numbers.
Nothing on the from-plays path reads `params.week` any more, so
setting it emits no SQL predicate: the column returns the full-season figure while the
config claims a week scope. It is not fully inert either — `get_cache_info_for_fields_from_plays`
and `cache-info-utils` still read it when deriving a cache key, so a stray `week` splits
the cache across entries that hold identical SQL. Wasteful rather than wrong, but there is
no reason to set it here.

`params.week` remains live for OTHER column families. `resolve_single_nfl_week_id`
(`libs-server/data-views/resolve-single-nfl-week-id.mjs`) reads it on behalf of the
projected and DFS-salary column definitions, so do not treat it as a dead param globally.
The rationale for keeping `week` out of the from-plays CTE alias key is written up at
`libs-server/data-views/get-stats-column-param-key.mjs:18`.

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

#### Projection `source_id` param

The raw-stat projection columns (`player_{week,season,rest_of_season}_projected_{pass_atts,pass_yds,…,rec_tds}`) read per-source rows from ONE TABLE PER PERIOD — `projections_index` for week, `season_projections_index` for season, `rest_of_season_projections` for rest-of-season — each carrying a row per projection provider. `make_projections_index_source({ period })` binds them; the season and rest-of-season arms set `join_week: false`, which is load-bearing rather than tidy, because `apply_projected_join` otherwise emits a week predicate against a table that has no `week` column. **The table alias carries the period.** It did not until 2026-08-29, and the defect was live: all three prefixes shared one alias key, so a view requesting week, season and rest-of-season `pass_yds` together emitted a SINGLE join and selected the identical expression under all three headers — no error, and no failing golden, because no golden mixed prefixes. Adding a third table without splitting the alias would have made week and season silently share a join. They accept a `source_id` param selecting the provider, defaulting to `external_data_sources.AVERAGE` (the consensus) so a column with no `source_id` is byte-identical to the pre-param behavior. The selectable set is the single source of truth `projection_data_source_ids` in `libs-shared/constants/source-constants.mjs`, surfaced in the UI by `projection_source_param` (`libs-shared/projection-source-column-param.mjs`). `source_id` is part of the table-alias hash, so the same column requested twice with different sources resolves to two independent joins rather than collapsing into one — as does the period, for the reason above.

The `points` columns (`player_{week,season,rest_of_season}_projected_points`) also accept the `source_id` param: they are now **computed in-query** from the same `projections_index`/`rest_of_season_projections` rows (scored by the selected scoring format's weights) rather than joined from the precomputed `scoring_format_player_projection_points` table. This makes projected points honor the source picker and stay self-consistent with the raw-stat columns shown beside them. The scorer is inlined in `libs-server/data-views-column-definitions/player-projected-column-definitions.mjs` (`projection_fantasy_points_sql`) and faithfully implements `calculatePoints({ use_projected_stats: true })`: `projected_base_stats` × format weights, a position CASE for non-uniform reception formats, `+ xpm`, the field-goal distance buckets (`3·fg19 + 3·fg29 + 3·fg39 + 4·fg49 + 5·fg50`, never `fgy/10`), and the full DST block.

**`projections_index` AVERAGE is the authoritative source of truth, and the in-query value is the correct one.** `projections_index` is the live, as-of-gametime frozen consensus projection: it retains each settled week's real projection (validated against the per-source frozen `projections` history — e.g. Joe Flacco 2025 week 9 is `242.5` pass yds in `projections_index`, matching all ~10 sources; a week that reads `0`, like Ja'Marr Chase 2025 week 12, is a real bye/inactive, not a dropped row). The precomputed `scoring_format_player_projection_points` is a **per-format derived cache** that was regenerated independently and went **stale** for past formats/years — so wherever the two disagreed, the cache was wrong and the in-query value is right. (This corrects an earlier reading that the two were merely "independently-timed snapshots that drift" and that `projections_index` "zeroes out past weeks" — both inaccurate.) The pipeline now re-derives that cache **from** `projections_index` every run (`process-projections` → `process_scoring_format_year`, shared with the `process-projections-for-scoring-format` reconciliation backfill; never the reverse), so the cache and the in-query column stay in lockstep to within rounding across all formats/years. Validation: 2025 season week-0 AVERAGE/draftkings already matched **989/989, max diff 0.00**; the historical-weekly divergence (draftkings 2025: 10,395/18,791 rows, max 23.63) was the stale cache and is removed by the reconciliation. Non-degeneracy spot-check (production): for a season's actively-projected players (any non-zero base stat), in-query AVERAGE points are `> 0` and within a plausible range for ≥95% — measured 623/623 (100%) for 2024.

The other three computed projection columns (`points_added`, `market_salary`, `points_added_positive_including_cap_savings`) are derived into `league_format_*`/`league_*` valuation tables that carry no `source_id` dimension and do **not** accept the param. `rest_of_season_projections` selection is wired but currently inert — only the AVERAGE source is materialized there today.

#### KeepTradeCut `as_of_month_day` param

The three KeepTradeCut columns (`player_keeptradecut_value`, `player_keeptradecut_overall_rank`, `player_keeptradecut_position_rank`) accept a column-scoped `as_of_month_day` param, stored as a bare `MM-DD` string. Under a **year row axis** it replaces the NFL opening day as the per-row as-of boundary, so each row resolves to the same calendar day within its own year — which is what lets a view author compare a player across seasons at a fixed anchor rather than at each season's opener. Unset, the emitter is byte-identical to its pre-param form, so no existing saved view or cached entry moves.

It is year-axis only. Under a week axis the week branch of the join wins and the param is ignored; the control hides itself there rather than offering a setting that does nothing.

Three properties of the boundary are load-bearing:

- **Leap-day clamp.** `make_date` RAISES rather than returning null on a day the month does not have (`make_date(2023,2,29)` is `date field value out of range`), and that aborts the whole statement. An inner `LEAST` resolves the anchor to the month's last day when the requested day overruns it, so `02-29` yields 2023-02-28 in a non-leap year and 2024-02-29 in a leap one. This is why the param is a bare `MM-DD` and not a DatePicker — a picker is bound to a concrete year and cannot express February 29 in a non-leap year at all.
- **`year_offset` folds into `make_date`'s year argument**, not into an interval added after the clamp. That ordering is what makes the clamp resolve in the target year: anchor `02-29` on row year 2023 with offset +1 is 2024-02-29, where clamping first and adding a year would give 2024-02-28.
- **Future clamp and recency floor are unchanged.** The outer `LEAST(..., now())` still prevents a boundary in the future, and the 30-day recency floor is still derived from the clamped boundary.

**A malformed value throws; it does not degrade.** Validation is three steps — an `MM-DD` shape regex, then `sql_integer_param` on each half, then a month 1-12 / day 1-31 range check — and all three are required, since `sql_integer_param` carries no range check and `13-01` would otherwise reach `make_date` and raise at execution. The throw sets `is_invalid_param`, which the four data-view routes map to 400; over the websocket (the SPA's actual transport) it surfaces as a `DATA_VIEW_ERROR`. This matches the shipped behaviour for a malformed `year` on the same column.

The param participates in the KeepTradeCut table-alias hash, so two columns differing only by it resolve to two independent joins rather than collapsing onto one alias. It also forces the six-hour cache TTL whenever it is set: `get_cache_info` never receives `row_axes`, so it cannot tell a year-split request from any other and no longer TTL can be justified.

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

All five resolve through ONE function, `resolve_nfl_week_dynamic_value` in `libs-shared/nfl-week-dynamic-values.mjs`, shared by the server expander, the client notice preview, the filter-chip label and the single-week resolver. It THROWS on an unrecognized type rather than answering an empty list — an unresolvable dynamic that still reads as an explicit time scope leaves the row axis unbounded, which is a fan-out with a correct-looking result set.

Half of these are forward-looking and half retrospective, and the two halves differ only during the six offseason months:

- `{ dynamic_type: "current_nfl_week" }` → the week in play or next up, anchored on `current_season.year` (e.g. `2024_REG_WEEK_5`; `<year>_REG_WEEK_1` in the offseason)
- `{ dynamic_type: "last_completed_nfl_week" }` → one step back from that, anchored on `current_season.last_completed_season_year` (`<year-1>_POST_WEEK_4` in the offseason)
- `{ dynamic_type: "current_year_reg_weeks" }` → every REG week of `current_season.year`, the season in play or about to start
- `{ dynamic_type: "last_n_nfl_weeks", value: 5 }` → the last 5 week identifiers, walking backwards across the season boundary
- `{ dynamic_type: "last_n_nfl_years", value: 3 }` → all week identifiers for the last 3 COMPLETED NFL years

`next_n_nfl_years` is retired and now THROWS rather than resolving to nothing.

It was not merely documentation: it was a labelled, value-bearing UI option on `nfl_week_id` with a full server resolver (`git show 0982c4a8f:libs-server/get-data-view-results.mjs:351`), live from `f68bb7ba3` until `df8d12ea9` removed it on 2026-04-22 with no migration rule. So a saved view COULD have persisted it. What makes the throw safe is the separately verified fact that none did — every `dynamic_type` across `user_data_views` is declared and resolves, confirmed independently twice, including against the 903-row `urls` table that saved views do not cover and that cannot be rewritten. This paragraph previously justified the throw by claiming the type had never had a resolver, which is false; the conclusion held but the stated reason did not, and a false justification is worse than none.

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

#### Where the generation catalog's param vocabulary comes from

`libs-server/data-views/generation/build-data-view-generation-catalog.mjs` builds the model-facing vocabulary for data-view generation. It is **derived in process at import and never committed** — a checked-in catalog artifact would rot against the registries the moment either moved, and silently, since the generator would keep offering a column id the server no longer answers.

It draws per-column params from **two** registries, and needs both:

| Source                                                                   | Declares `column_params` on | Holds                                                                                              |
| ------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------- |
| Server column definitions (`libs-server/data-views-column-definitions/`) | 56 of 597 columns           | The executable spelling; wins a key collision                                                      |
| Client field registry (`app/core/data-views-fields/`)                    | 357 columns                 | `time_type`, `nfl_week_id`, `output`, `market_type`, `source_id` — most of what a user reaches for |

The client registry was unreadable from the server until 2026-08-28, which held catalog param coverage at 56 of 597 columns and made measured param agreement 0.009. The obstacle was **extensionless relative specifiers** (`from './column-groups'` resolves under webpack and not under bare Node ESM), not React — only 5 of 33 modules import `react` or `@components`, and those five stay carved out, detected from source text rather than by filename. `read-client-column-params.mjs` carries the detail.

**A third param source exists and is not in the catalog.** Some column definitions read a key straight out of `params` in their own query builder without declaring it anywhere — `sourceid` and `scoring_format_id` in `player-projected-column-definitions.mjs` are the live examples, and `data-views-saved-view-migration.mjs` itself writes `output_column_params`. These are real, honoured params that no registry lists, which is why `resolve-generated-table-state.mjs` still does not check that a param KEY exists: over the 189 production saved views such a check rejects 11 views on 55 errors, and 43 of those 55 are these undeclared-but-working keys.

`search-columns.mjs` provides retrieval over the catalog so a caller pulls the columns an instruction is about, with param vocabulary attached, instead of being pushed all 597.

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
  row_axes,
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

// Determines row_axes strategy based on request
if (row_axes.includes('week') || row_axes.includes('year')) {
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
  row_axes = [],           // Active split dimensions
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
      row_axes,
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
    supported_row_axes: ['week']
  },
  'player_gamelogs': {                // General table
    group_column_params: { year: [2023, 2022] },
    where_clauses: [...],
    select_columns: [...],
    supported_row_axes: ['year', 'week']
  }
}
```

#### `group_tables_by_supported_row_axes()` - Split Compatibility

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
  WHERE player.primary_position IN ('QB', 'RB', 'WR')  -- Early position filtering
)
```

**Query Structure Modification**:

```javascript
// Base query (no row_axes)
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
  WHERE nfl_year_week_timestamp.year = 2024        -- Single year optimization
    AND nfl_year_week_timestamp.week IN (1, 2, 3)  -- Requested weeks only
)
```

Both predicates are optional and independent. The year clause appears only when
the resolved year range is a single year; the week clause appears only when at
least one column or where clause carries a `week` param, and it holds the union
of those params across the request — the same scoping `get_year_range` applies to
the year axis, so a column that omits `week` contributes nothing rather than
widening the union back to every week.

The team analogue (`team_years_weeks`) is built by the same rule.

**Performance Benefits**:

- Single-year filtering reduces CTE size significantly
- Week filtering drops the row universe to the requested weeks (a three-week
  request scans 3 of 18 weeks rather than all of them)
- INNER JOIN on timestamp table leverages indexes
- Eliminates redundant player-week combinations

#### Participation Signal (inactive vs zero vs bye)

At week grain the row universe (`player_years_weeks`) emits a row for every REG week in scope, including weeks a player did not play. Stat CTEs are `LEFT JOIN`ed with no outer `COALESCE`, so a no-contribution week yields `NULL` — indistinguishable from an inactive/DNP/bye week. To disambiguate, the query builder auto-injects one hidden value per `(pid, year, week)` row under the literal alias `participation_status`:

- `active` — a `player_gamelogs` row exists with `is_active = true`. A null/zero numeric stat means the player **played but recorded zero** → renders **`0`**.
- `bye` — no gamelog row **and** none of the player's season teams played that week → renders **`BYE`**.
- `NULL` — everything else (inactive, DNP, IR, not-rostered) → renders **blank**.

Mechanics and constraints:

- **Auto-injection gate** (`get_data_view_results_query`): player (non-team) row grain + `row_axes` includes `week` + REG-only scope + non-empty year range. No user column, and `participation_status` is **not** in `table_state.columns`, so the `table_state` hash (cache key) is unchanged — old cached rows simply lack the field and render as before.
- **Source CTEs** (`participation-status-cte.mjs`, composing `player-team-bridge-cte.mjs` + `period-denominator/per-game.mjs`): `player_participation_weeks` (the gamelog⋈games join with the `is_active` filter relaxed, `bool_or(is_active)`), `team_weeks_played` (DISTINCT team-weeks, shared with the per-game denominator union), and `player_years_teams`.
- **Row grain stays 1:1**: the bye check is a correlated `NOT EXISTS` against `team_weeks_played`, **not** a top-level `LEFT JOIN` — a mid-season-traded player's `teams[]` can match multiple team-weeks in one week, and a join would fan the output row and corrupt stat aggregates.
- **Year reference** is derived from the joined week-source CTE (`player_years_weeks.year`), not the identity's `player_years.year` (a lower-grain CTE not joined at week grain).
- **Stat values are never rewritten** — only display changes. Sorting, aggregation, and stored semantics are unaffected. The pure null→marker decision and the `active`/`bye` string constants are single-sourced in `libs-shared/data-views/participation-cell.mjs` (`render_participation_null`), imported by the client render hook, the client export hook, and the server export route; the server CASE imports the same constants so emitted value and decoded marker cannot drift.
- **Rendering**: `mistakia/react-table`'s `table-cell` gained a `render_null` hook (per-column, else `meta.render_null`) plus a null guard on the percentile color. Numeric data-view columns set `render_null`/`export_value` (gated on week grain in `data-views.js`); the export route (`api/routes/data-views.mjs`) substitutes the marker for null numeric cells and strips the reserved `participation_status` column.
- **Limitation (v1)**: a player dressed-inactive for an entire season has no `player_years_teams` row, so his bye weeks render blank rather than `BYE`; trade-boundary precision is likewise conservative. Precise resolution is deferred to the bye-precision follow-up.

### Centralized Reference System

Every join fragment refers to the query's subject through four references — `pid_reference`, `team_reference`, `year_reference`, `week_reference` — rather than naming a table itself. This is what lets the same column definition attach under any row grain and under from-table sort optimization.

**Resolution**: `resolve_references({identity_id, from_table_name})` in `libs-server/data-views/identities.mjs` is the single resolver, called from the dispatcher at `libs-server/get-data-view-results.mjs`. It is identity-first and FROM-aware:

- Team identities resolve to the identity's own columns (`team.team_code`, `team_years.year`).
- A player query whose FROM is the canonical `player` table resolves to the identity CTEs (`player.pid`, `player_years.year`, `player_years_weeks.week`).
- A player query whose FROM has been optimized onto a fact table resolves to that table's own `pid` / `year` / `week` columns, so no bridge CTE is required for the reference alone.

**Two carriers, one source**: `build_query_context` populates the references from the resolved identity, and `query_context` retains those identity-derived values end to end. The dispatcher additionally mirrors the FROM-aware resolution onto `data_view_options` for the shared join helpers that read from it. `query_context` is the source of truth; `data_view_options` is the FROM-table-aware override layer.

Identity-derived references are why `is_team` no longer exists as a flag — `is_team_identity(identity_id)` decides team-versus-player branching, and the references follow from the identity rather than from a per-column declaration.

See [data-views-architecture.md](./data-views-architecture.md) for the identity registry and the full reference contract.

- **Better Maintainability**: Single source of truth for all reference patterns

### Table Processing Order Optimization

**Performance-Driven Sorting**:

```javascript
const sorted_grouped_by_row_axes = Object.entries(grouped_by_row_axes).sort(
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

### Accumulator → behavior

| aggregate        | rendered as            |
| ---------------- | ---------------------- |
| `sum`            | `SUM(expr)`            |
| `count`          | `COUNT(expr)`          |
| `count_distinct` | `COUNT(DISTINCT expr)` |

A measure declares a SET of these plus a combine applied strictly after accumulation, so the same declaration renders at the season grain, at period grain inside the aggregator CTE, and one grain coarser over an offset window. `decimals` sits outside the combine: `null` wraps neither render in `ROUND`, and an integral value is never rounded at the season grain because a count has nothing to round.

### Carve-outs

There are none. Every column in both from-plays factories declares accumulators — the averages, the compound ratios and the shares included — which is what lets the fail-fast invariant below take its strong form.

### Fail-fast invariant

Scoped inside the two migrated factories: EVERY column MUST declare a `measure`. Violations throw at module load, making the silent-rate-drop regression class structurally impossible rather than merely declared against. It used to be the weaker "a column advertising any rate type must declare one", because a column could opt out with `supports_periods: []` and stay on a raw select string; there is no opt-out left. The `role_attributions` / explicit-`supports_output` factories (defensive, fantasy-points) never call `derive_measure` and are exempt by construction — a global registry sweep would wrongly throw for them.

## Output Aggregation

The `output` param on a numeric measure column parameterizes how that measure collapses into a cell. There are TWO families and `period` means a different thing in each:

| Family       | Evaluation                             | `period` is                                              | Aggregations    |
| ------------ | -------------------------------------- | -------------------------------------------------------- | --------------- |
| `pooled`     | one combine over the whole scope       | a denominator unit (`game`, `team_play`, `player_route`) | `rate`          |
| `per_period` | combine per period, then reduce across | a partition of time (`game`, `season`)                   | `count`, `mean` |

`rate` and `mean` are different measures rather than two spellings of one: `rate` divides by a denominator UNIT (games PLAYED) and `mean` by the periods CARRYING measure rows. Measured on 2023 REG receiving yards, 366 of 482 players disagree. A column offers whichever of the two its subject grain supports, normally both, whatever its combine looks like. It replaced the `rate_type` token system; `rate_type` remains permanently accepted on the request path because shared short URLs carry it, and is translated to `output` by `normalize-output-param.mjs` before anything else reads it.

```
output: {
  period: <period token> | null,
  aggregation: 'sum' | 'rate' | 'count',
  threshold: { op, value } | null
}
```

### Registry dispatch

`libs-server/data-views/output-aggregator-registry.mjs` maps `(period, aggregation)` to a plugin. `apply_output_aggregator` resolves the plugin, names the CTE, registers it, joins it, and emits the outer SELECT. Registered `rate` periods cover the legacy tokens with the `per_` prefix stripped (`game`, `team_play`, `player_route`, ...) plus `player_touch` and `player_opportunity`; `count` registers `game` and `season` only.

The plugin interface is `consumes_params`, `get_cte_name`, `add_cte`, `join_cte`, `emit_outer_select`.

**`consumes_params` is the correctness-critical field.** It is a declarative allowlist, never inferred, and it feeds the CTE-name hash. A param that changes the CTE's contents but is absent from the list makes two columns differing only in that param resolve to the same CTE and return identical values — no error, no failing test, a wrong answer. `year`, `year_offset`, and `week` were each added after producing exactly that defect.

### CTE reuse and measure batching

`output-aggregator/measure-batch.mjs` keys a batch on the measure source, period, identity, pid columns, rendered predicate, `apply_filters` body, team unit, and the consumed-params signature. Measures sharing a key share one scan, emitting `SUM(expr) AS m_<hash>` per measure from a single materialized CTE named `rate_<period>_<md5 prefix>`.

Registration is deferred: `register_measure` accumulates into `query_context.measure_batches` and `flush_measure_batches` materializes after the per-column dispatch loop has seen every column. Role-union sources are excluded from batching.

This is a live tension. Adding a param to `consumes_params` fragments batches and costs `nfl_plays` scans; omitting one silently merges columns that must differ. Correctness wins.

### Period CTE construction

`output-aggregator/build-period-cte.mjs` builds the scan. `period` is one of `game` (period key `year_week_esbid`), `season` (period key `year_seastype`), or `aggregate` (no period key — the numerator-only path that collapses to subject and year). Anything else throws.

`build_role_union_period_cte` handles `measure_source: 'plays_role_union'`, where one play attributes to several players — a touchdown pass scores both passer and receiver, which a single-pid `COALESCE` cannot express. It emits a `UNION ALL` over per-role attributions. `build_batched_period_cte` handles every other source and is the coalescing path.

### Emitted SQL

`aggregator-rate` emits `SUM(measure) / NULLIF(COUNT(period_key), 0)`, wrapped in `ROUND` when the column declares `decimals`.

`aggregator-count` emits `COUNT(DISTINCT period_key) FILTER (WHERE measure_total <op> ?)`. The threshold applies to the aggregated per-period total, not to individual rows, so "games with 100+ receiving yards" counts games rather than plays.

### Row-axis sanitization

Under a `week` row axis, `normalize-output-param.mjs` silently drops `{period: 'game', aggregation: 'rate'}` — the per-game denominator is always 1 at week grain — and throws on `{period: 'season', aggregation: 'count'}`.

For the identity registry, source-attach rules, and the full column contract, see [data-views-architecture.md](./data-views-architecture.md).

## Performance Optimization Strategies

### Year-Specific Table Selection

**Automatic Partitioned Table Usage**:

```javascript
// Column definition optimization
table_alias: ({ params, row_axes }) => {
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
  row_axes,
  data_view_options // Contains centralized year_reference, week_reference, pid_reference
})
```

**Logic and Performance Impact**:

- **INNER JOIN**: When filtering (reduces result set size early)
- **LEFT JOIN**: For optional data (preserves all players for comprehensive analysis)
- **Performance gain**: INNER JOINs can reduce subsequent processing by 90%+

### CTE Reuse Strategy

Output-aggregation CTEs are shared across columns whose scans are identical. `output-aggregator/measure-batch.mjs` computes a batch key from the measure source, period, identity, pid columns, rendered predicate, `apply_filters` body, team unit, and the plugin's declared `consumes_params` signature; every measure with the same key is emitted from one materialized CTE. Idempotency is enforced by `query_context.applied_output_ctes` and `query_context.joined_output_ctes`.

Reuse and correctness pull against each other here. A param omitted from `consumes_params` widens reuse and silently merges columns that must differ; a param added narrows it and costs an extra scan. See § Output Aggregation.

**Performance Benefits**:

- Eliminates redundant CTE calculation
- Reduces query complexity and parse time
- Enables PostgreSQL query plan optimization

### Team-Scoped Joins

**Problem**: Team-stat columns, rate-type `per_team_play` denominators, and rate-type `per_game` team denominators historically joined on `player.current_nfl_team`. This fails for (a) retired players (`current_nfl_team = 'INA'`), (b) historical queries where the player was on a different team, and (c) current-season queries for players traded mid/post-season (Stefon Diggs 2025 is the canonical repro).

**Solution**: A shared `player_year_teams` CTE (`pid → year → primary_team`) sourced from `player_gamelogs` joined to `nfl_games` where `seas_type = 'REG'`. Primary team per `(pid, year)` is selected by `(array_agg(tm ORDER BY game_count DESC, tm ASC))[1]` — most regular-season games, alphabetical tie-break.

**Registration**: the CTE and its outer-query LEFT JOIN are encapsulated in the `player_year` -> `team_year` identity bridge (`libs-server/data-views/identity-bridges/player-year-to-team-year.mjs`). Consumers invoke it via `apply_bridge({ query_context, from: 'player_year', to: 'team_year', params, source })` (`libs-server/data-views/identity-bridge-registry.mjs`). `apply_bridge` is idempotent — `query_context.applied_bridges` keys on `"<from>-><to>|<mode>"`, so the second call from a different consumer no-ops. The retired `historical-team-mode.mjs` module previously gated bridge attachment on `has_year_filter(params) || row_axes.length > 0`; that predicate was retired in `f13f8300` once the bridge became always-on for the contexts that invoke it (the consumer decides whether to invoke based on its own predicate — e.g., `period-denominator/per-team-play.mjs` invokes when the subject identity is `player` and there is no `matchup_opponent_type`). Source-attach rules in `libs-server/data-views/source-attach/` invoke the bridge automatically when a `team_year`-shaped source attaches to a `player`-shaped cell.

**Year resolution** (`resolve_year_range` in `player-year-to-team-year.mjs`): the year range used to materialize the CTE and to pin the join's `year =` clause follows a 4-step fallback so the bridge is robust in offseason / source-attach contexts where `query_context.year_range` is empty:

1. `query_context.year_range` (year or week split present).
2. `params.year` (explicit per-column override).
3. `source.year_default(params)` (the attaching source's anchor year, e.g. ESPN team-stats defaults to `current_season.last_completed_season_year`).
4. `[current_season.year]` (defensive last resort).

Without step 3, attaching a `team_year` source on a player cell with no year split would have materialized `player_year_teams` for `current_season.year` (e.g. 2026 mid-offseason) and the source-attach join would find no rows, returning NULL for every active player.

**Outer-query join year** (`join_cte`): when a `year` split is active, the join binds on `query_context.year_reference` so each (pid, year) row binds to that row's year. Otherwise the join pins to `max(year_range)`. The multi-year-no-split case (where this pinning misattributes traded players' stats) routes through the wrap CTEs described above, which INNER JOIN `player_year_teams` on (pid, year) instead.

**Consumer sites** (non-exhaustive — every site that maps a player cell to a team-year scope routes through this bridge):

- `libs-server/data-views/period-denominator/per-team-play.mjs:join_per_team_play_cte` (and the wrap path in `per-team-play-wrap.mjs`).
- `libs-server/data-views/team-stats-from-plays-wrap.mjs` consumers (via `add_team_stats_play_by_play_with_statement.mjs`).
- `libs-server/data-views/source-attach/rules/player-family-to-team-year.mjs` (auto-attached team-year sources on player cells).
- `libs-server/data-views/output-aggregator/aggregator-rate.mjs` and `aggregator-count.mjs` (team-grain numerator/denominator joins for player subjects).

Each site falls back to `player.current_nfl_team` only when the bridge is not applicable — typically when `matchup_opponent_type` is set (the column joins through the upstream opponents CTE) or when the subject identity is `team` (no player-to-team mapping needed).

**`team_attribution` param** (`'historical'` default | `'current'`): a per-column param that lets a view author choose which team a player-cell team RATE stat (`per_game`, `per_team_play`) attaches to, making explicit a semantic that was otherwise implicit-and-fixed. `'historical'` (default) is the bridge behavior above — the player's per-year team-of-record (`player_year_teams.team`). `'current'` attributes the stat to `player.current_nfl_team` (a forward-looking projection — a mover's NEW team's volume, e.g. a 2026 redraft view), skipping the bridge entirely. The param is read through one helper, `get_team_attribution(params)` in `resolve-team-join-target.mjs`, used at all three historical-bridge sites (the active resolver in `aggregator-rate.mjs`, the passive resolver in `resolve-team-join-target.mjs`, and the `requires_wrap` gate in `per-team-play-wrap.mjs`), so the two halves of a rate always resolve to the SAME team and the duplicated branch cannot drift (pinned by `test/data-views.team-attribution.spec.mjs`). Honored consistently across numerator, denominator, and the multi-year-no-split wrap (which `'current'` bypasses — there is no per-year team to reattribute when all volume goes to one team). Edge cases: a free agent (`current_nfl_team = 'INA'`) under `'current'` blanks both halves consistently (no last-team fallback — out of scope); a year-split under `'current'` repeats the single current-team snapshot across year rows (well-defined projection, not an error). Confined to the two rate types in v1; team-stats-from-plays COUNTING columns and the select-string year-offset branch do not declare it and are unchanged (deferred to `task/league/data-views/extend-team-attribution-to-counting-columns.md`). NOTE: because of the `data_view` socket cache-TTL-unit bug (`task/league/data-views/fix-data-view-socket-cache-ttl-unit.md`), a value change from flipping this param will not surface until the affected view's cache is manually invalidated/warmed.

**Defensive-unit reasoning**: `period-denominator/per-team-play.mjs` uses a single join expression regardless of `team_unit` ('off' or 'def'). `player_gamelogs.nfl_team` stores the player's own team; for defensive players that equals the defensive team on `nfl_plays.defense_nfl_team`, so no branch is needed.

**Partition pruning**: the inner subquery applies `WHERE nfl_games.season_year IN (year_range) AND player_gamelogs.season_year IN (year_range)`. The second predicate is essential — `nfl_games.season_year` alone does not prune the `player_gamelogs` partitioned table.

**Coexistence with `teams` array_agg**: the `teams` aggregation in `period-denominator/per-game.mjs:add_player_per_game_cte` (consumed by the `player_nfl_teams` column) is left untouched. It returns the full set of teams for multi-team display, while `player_year_teams.team` returns the deterministic primary team for joining.

**Every player-to-team bridge resolves ROSTER MEMBERSHIP, so none of them filters `player_gamelogs.is_active`** — not `player_year_teams`, and since 2026-08-23 not `player_years_teams` / `player_years_weeks_teams` in `data-views/player-team-bridge-cte.mjs` either. They must agree, because a single view routes the team-IDENTITY columns (`team_code`, `team_name`, `team_conference`, `team_division`) through the second pair and `team_*_from_plays` through the first, onto the same row. While the identity bridges filtered on active and the join bridge did not, a player carrying gamelogs but no active REG game rendered a BLANK team beside populated team stats — 5,076 of 53,767 player-years measured on production, including AJ Dillon 2024 (GB, whole season on IR) and Alexander Mattison 2025 (MIA). The filter also decided 220 player-years' primary team, in every case observed by breaking a COUNT TIE rather than a real disagreement (Bradley Chubb 2022: MIA 9 gamelogs / 8 active against DEN 8 / 8). Participation is a separate signal with its own CTE, `player_participation_weeks`, which is now the only reader of the flag — see [[user:task/league/distinguish-inactive-from-zero-in-data-views.md]]. Note the week bridge must GROUP rather than project `ARRAY[team_code]` row-for-row: the gamelog PK is `(esbid, pid, year)` and is not unique on week, so 20 production `(pid, year, week)` keys carry two gamelogs naming two different teams and would otherwise fan out the player's week row through the LEFT JOIN.

### Lazy Evaluation Pattern

**On-Demand Resource Creation**:

```javascript
// Only join tables when actually needed
if (join_func) {
  await join_func({/* join parameters */})
} else if (select_strings.length || main_where_clause_strings.length) {
  players_query.leftJoin(table_name, `${table_name}.pid`, 'player.pid')
}
```

**Memory and Performance Benefits**:

- Reduces unnecessary table scans
- Minimizes memory footprint
- Enables PostgreSQL to optimize JOIN order

## State Management and Data Flow

### Reference and FROM resolution

#### `resolve_references({ identity_id, from_table_name })`

Defined in `libs-server/data-views/identities.mjs`. Returns `pid_reference`, `team_reference`, `year_reference`, and `week_reference` for the active identity, adapted to the FROM table sort optimization picked. `build_query_context` calls it to populate `query_context`; the dispatcher mirrors the FROM-aware result onto `data_view_options` for the shared join helpers. See § Centralized Reference System.

#### `get_from_table_config({ sort, columns, prefix_columns, row_axes, data_views_column_definitions })`

**Purpose**: Determines the optimal from table configuration with whitelist-based rollout.

**Parameters**:

- `sort` (Array): Sort configuration from user request
- `columns` (Array): Column configurations
- `prefix_columns` (Array): Prefix column configurations
- `row_axes` (Array): Active split dimensions
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

  // FROM-aware reference mirror, resolved by resolve_references()
  pid_reference: 'player.pid',
  team_reference: null,
  year_reference: 'player_years.year',
  week_reference: 'player_years_weeks.week',

  // Optimization state
  matchup_opponent_types: new Set() // Required opponent CTEs
}
```

`query_context` (`libs-server/data-views/query-context.mjs`) is the identity-derived source of truth and carries the row grain, row axes, identity id, year range, the four references, and the idempotency sets `applied_bridges`, `applied_output_ctes`, `joined_output_ctes`, and `registered_ctes`. `data_view_options` above survives as the FROM-table-aware override layer. Output-aggregation CTE reuse lives on `query_context.applied_output_ctes` and `query_context.measure_batches`, not on a `rate_type_tables` map.

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

**Export endpoint cache**: `GET /api/data-views/export/:view_id/:export_format` caches `data_view_results` in Redis under a hash of `where`/`columns`/`sort`/`offset`/`prefix_columns`/`row_axes`, independent of the TTL logic above -- it defaults to 12 hours when a column's `cache_ttl` metadata is absent. A row that should now qualify (e.g. a player just backfilled with a new external id or value) can still be missing from an export for up to that long. Pass `?ignore_cache=true` to force a fresh query when verifying a just-shipped data fix.

#### `rate_type_column_mapping` (removed)

This mapping and its `get_rate_type_sql` emitter were the pre-output-aggregator rate-type dispatch. They became permanently dead once `normalize_output_param` began rewriting `params.rate_type` into `params.output` before any consumer ran (the mapping stayed `{}`, so every read yielded `undefined`). The declaration, its threading through `select-string.mjs` / `where-string.mjs` / the from-plays factories, and `get_rate_type_sql` were retired in the measure-first refactor. Rate output now flows exclusively through the output aggregator (`output-aggregator-registry.mjs` → the `period-denominator/` plugins and `output-aggregator/`).

## Error Handling and Edge Cases

### Input Validation Strategy

#### Schema and Business Rule Validation

```javascript
const validator_result = validators.table_state_validator({
  row_axes,
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

#### Output Compatibility Filtering

```javascript
// Skip a column that does not support the requested period without failing
if (
  !column_definition ||
  !column_definition.supports_output ||
  !column_definition.supports_output.periods.includes(period)
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

**Service objectives** (the sub-5s target, no-idle-wait queueing, and the telemetry/signal/backstop goals) are canonical at [[user:text/league/data-views/data-view-service-objectives.md]] — any performance or extension work here is measured against them.

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

// Current system - references resolved once from the active identity
const query_context = build_query_context({
  row_grain,
  row_axes,
  year_range,
  params,
  db
})
// Carries: pid_reference, team_reference, year_reference, week_reference

await add_clauses_for_table({
  players_query,
  query_context
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

- `resolve_references()` in `identities.mjs` derives all four references from the active identity, adapted to the chosen FROM table
- `query_context` carries them end to end; `data_view_options` mirrors the FROM-aware result for the shared join helpers
- Output-aggregation CTEs join through those same references, so a rate and its denominator cannot resolve to different subjects
- Player PID reference adapts to from table optimization (`player.pid` vs `from_table.pid`)
- Team identities resolve `team_reference` instead, which is what makes the same column definition work under both row grains

#### 2. From Table Optimization with Whitelist System (Implemented)

**Strategy**: Start queries from the most selective table rather than always using `player` table, with gradual rollout using whitelist.

```javascript
// Determine optimal starting table from sort column and row_axes
const from_table_config = get_from_table_config({
  sort,
  columns,
  prefix_columns,
  row_axes,
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
return setup_default_from_table(row_axes)
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
      rowAxesRequirements: this.analyzeRowAxes(request),
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
 * // Returns: "player.primary_position IN ('QB', 'RB')"
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

The contract below applies to every CTE builder backing a data-view column -- both the rate-type denominator CTEs in `libs-server/data-views/period-denominator/` and the stat-column CTEs in `libs-server/data-views/add-*-play-by-play-with-statement.mjs` plus the inline `with:` handlers on `player-fantasy-points-from-plays-column-definitions.mjs` and the `create_team_share_stat` factory in `player-stats-from-plays-column-definitions.mjs`.

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

- `current_nfl_week_params()` → `{year, seas_type, week}` with POST using `nfl_seas_week`, REG using `week`, year from `current_season.year`. The FORWARD-looking half: the week in play or the next one up. It took its year from `last_completed_season_year` until 2026-08-27, which composed an identifier out of two different seasons and served the prior year's week 1 for the whole offseason.
- `last_completed_nfl_week_params()` / `last_completed_nfl_week_identifier()` → the retrospective half, defined as one step back. Its year equals `current_season.last_completed_season_year`, which is the invariant pinning the pair (it holds everywhere except during live REG week 1, where the season getter reads ahead).
- `current_nfl_week_identifier()` → formatted `nfl_week_id` string.
- `nfl_week_offset_params({ offset })` → canonical triple for a negative offset, honoring the REG↔POST boundary AND the season boundary: REG week 1 of year Y steps back to POST week 4 of Y-1. Returns `null` only below `MIN_YEAR` (2000). Throws on positive offsets. It used to stop dead at REG week 1, which truncated every `last_n_nfl_weeks` list to a single week for the whole offseason.
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

The `OBJECT_PRESET` data type (`TABLE_DATA_TYPES.OBJECT_PRESET = 9`, formerly `PERSONNEL_GROUP`) is a multi-column conjunctive filter for value-object presets such as offensive and defensive personnel packages. Used by the `offense_personnel` and `defense_personnel` column params in `libs-shared/nfl-plays-column-params.mjs`. The data type is generic in `react-table`; football-specific key whitelisting lives in `libs-shared/validators/personnel-group.mjs`.

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
  (offense_personnel_running_back_count = 1 AND offense_personnel_tight_end_count = 1 AND offense_personnel_wide_receiver_count = 3)
  OR
  (offense_personnel_running_back_count = 1 AND offense_personnel_tight_end_count = 2 AND offense_personnel_wide_receiver_count = 2)
)
```

Keys absent from a value object are not constrained. This lets defensive presets like Nickel (`{ db: 5 }`) match without imposing DL/LB constraints.

### Param Definition

Each OBJECT_PRESET param specifies:

- `column_specs`: array of `{ key, column, label, min, max, advanced? }` mapping object keys to physical columns and providing UI bounds.
- `preset_values`: array of `{ label, value, n }` describing common packages with row-count annotations for tooltip display.

### Backing Columns

Authoritative columns (parsed from the NFL-feed `offense_personnel` / `defense_personnel` strings):

- `offense_personnel_quarterback_count`, `offense_personnel_running_back_count`, `offense_personnel_tight_end_count`, `offense_personnel_wide_receiver_count`, `offense_personnel_offensive_line_count`
- `defense_personnel_defensive_line_count`, `defense_personnel_linebacker_count`, `defense_personnel_defensive_back_count`

PlayerProfiler-source columns (preserved snap-classification counts, not used by the filter):

- `offense_personnel_running_back_count_per_play`, `offense_personnel_tight_end_count_per_play`, `offense_personnel_wide_receiver_count_per_play`

Per-partition composite indexes cover `(offense_personnel_running_back_count, offense_personnel_tight_end_count, offense_personnel_wide_receiver_count)` and `(defense_personnel_defensive_line_count, defense_personnel_linebacker_count, defense_personnel_defensive_back_count)`.

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
{ "table_state": { "where": [ ... ] }, "target_param_name": "offense_personnel" }
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

Rule #2 resolves `nfl_week_id` `dynamic_type` values through the SAME `resolve_nfl_week_dynamic_value` the server expander uses, so the notice and the query cannot describe different spans — they did, before the consolidation, because the client anchored `last_n_nfl_years` on the last completed season and the server on the current one. Params other than `nfl_week_id` still skip the check rather than risk false positives.

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

## A column's `source.grain` silently determines which row axes it can ever see

`derive_supported_row_axes_from_source` (`libs-server/get-data-view-results.mjs`) resolves a column's supported axes from `source.grain` unless the column declares an explicit `source.supports_row_axes` override, and `group_tables_by_supported_row_axes` then INTERSECTS the request's `row_axes` with that set. An axis the grain does not declare is dropped before the column definition ever runs.

**The failure mode is dead code that looks live.** A column definition can carry a fully written `row_axes.includes('week')` branch -- joins, boundary predicates, a `week_select` -- and never execute a line of it, with nothing anywhere reporting a problem. The KeepTradeCut columns carried exactly that for an unknown length of time: `grain: 'player_year'` resolves to `row_axes: ['year']`, so their entire week branch was unreachable, including a `leftJoin(..., on true)` cross join that would have been a defect the moment it ran.

Two things make this hard to see, both worth knowing before you trust a search:

- **A grep for the column can match only the table name.** Searching the goldens for `week_timestamp` returns a dozen files, every hit being the substring inside `nfl_year_week_timestamp`. The column was projected by nothing. Anchor such a grep on the qualified form (`\.week_timestamp`) or read the hits.
- **The request field is `row_axes`, not `splits`.** A probe passing `splits: ['year','week']` exercises the YEAR path while reading as a week test, and every case returns valid SQL. Assert on the emitted SQL -- is the axis-specific join actually present -- rather than on the absence of an error.

When a column should support an axis its grain does not declare, add `supports_row_axes` to its `source` and update the column-family spec under `docs/data-view-specs/` to match; the spec and the code disagreeing is itself invisible to every gate.

## Sandboxed SQL Tier

The registry composes 597 columns; the long tail of analytical questions it cannot express is served by executing generated SQL directly, under a sandbox. The ceiling on that tier is not the query language but the table allowlist, so it is as expressive as the allowlist is wide.

It is a TOOL rather than a terminal tier. The generation agent chooses between the registry and SQL by attempting the registry and observing that it falls short, so SQL is not something reached only after the registry dead-ends.

### How a request reaches it

The SQL path enters `execute_data_view_request` as an alternate `run_query` — the same admission gate, timeout policy and telemetry every other data-view path uses, not a fifth execution path:

```js
execute_data_view_request({
  params: { sql_text, where, sort, offset, limit },
  run_query: execute_generated_sql,
  path: 'sql',
  skip_cache: true,
  user_id
})
```

**Result caching is off on this path.** `get_data_view_hash` knows nothing about SQL, so two different statements at the same offset and limit share a cache key and would serve each other's rows. The query-backed data-views work adds `query_id` to that hash and turns caching on.

### The controls, and which are load-bearing

| Control                       | File                                                                                         | What it stops                                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statement guard               | `libs-server/data-views/generation/validate-generated-sql.mjs`                               | multi-statement injection, writes and DDL at any depth, `lockingClause`, `SELECT ... INTO`, non-allowlisted relations, set-returning functions in `FROM`, unaliased or duplicate output columns |
| Scoped role                   | `league_data_view_reader`, granted by `db/adhoc/2026-08-28-create-data-view-reader-role.sql` | reads of every relation outside the allowlist, every write, every table added after the grant                                                                                                   |
| Separate pool                 | `db/sandbox-pool.mjs`                                                                        | the role's privileges cannot be shed. `SET ROLE` on the main pool would not be a control, because `RESET ROLE` is available from inside any session                                             |
| Read-only transaction         | `libs-server/sandboxed-read.mjs`                                                             | writes the role would otherwise be granted. `SET TRANSACTION READ ONLY`, never `SET LOCAL default_transaction_read_only`, which is a measured no-op inside an open transaction                  |
| `SET LOCAL statement_timeout` | same                                                                                         | a runaway statement, under the server's 30s baseline                                                                                                                                            |
| Plain `EXPLAIN` preflight     | same                                                                                         | nothing executes; `EXPLAIN ANALYZE` does execute and is never used                                                                                                                              |
| Row cap and outer `LIMIT`     | `execute-generated-sql.mjs`                                                                  | an unbounded result set                                                                                                                                                                         |

The parser and the role are independent, and neither is trusted alone. Two cases show why both are needed: `pg_stat_statements` is granted to PUBLIC, so no GRANT can deny it and only the parser stops it; and a view executes with its owner's privileges, so a table-level exclusion does not bind one — granted views are enumerated individually and none may read an excluded relation.

### The envelope is shared; the guard and the allowlist are not

The middle three controls live in `libs-server/sandboxed-read.mjs` because a second consumer runs inside the same envelope: the contribution reproduction substrate, which re-executes registry-generated SQL from a captured `table_state` to confirm a reported bug. Each of those controls has a non-obvious reason to be exactly what it is, and one copy of that reasoning is the point.

The statement guard and the relation allowlist are deliberately NOT shared. They encode the threat model of a caller that WROTE the statement. Measured 2026-08-31: all 280 stored data-view fixtures fail this tier's guard — 227 on the alias contract, 53 on relations outside the allowlist — because registry SQL was never written to satisfy a contract that exists to make agent-authored SQL safely wrappable. So the reproduction path gets its own role, `league_contribution_reader`, whose list differs by exactly three relations (`opening_days`, `nfl_year_week_timestamp`, `rosters_players`) and is reviewed on its own terms in `db/tools/generate-reader-role-grants.mjs`.

**One assertion in the spec was vacuous until 2026-08-31.** `runs inside a read-only transaction, asserted on the session variable` executes on a pool whose role carries `default_transaction_read_only = on`, so `transaction_read_only` reads `on` whether or not the envelope issued `SET TRANSACTION READ ONLY` — deleting that statement left all 24 assertions green. The paired assertion beside it runs the same check on the unhardened control role, which carries no such attribute, and is the one that actually goes red.

### The allowlist

The grant is an explicitly enumerated list generated by `db/tools/generate-reader-role-grants.mjs`, reviewed relation by relation, with a stated reason on every exclusion. It is deliberately NOT a broad sweep minus an exclusion list: that method produced gaps that a review found — `public.config` (third-party API credentials and a Discord webhook), the admission-vote table that actually holds ballot content, and a second saved-views table among them.

The role receives neither arm of the standing `ALTER DEFAULT PRIVILEGES` grants, TABLES or SEQUENCES, so every future relation is denied until someone adds it to that tool. Widening later is cheap; narrowing is never needed.

### The alias contract

Every statement must project uniquely and explicitly named output columns. That is what makes the subquery wrapping safe, gives the row-key convention something stable to key on, and makes the annotation reconciliation total. Three AST shapes fail OPEN if handled naively, and each is named at its branch in the guard with a spec of its own: a set operation carries no top-level `targetList`; a `VALUES` list carries neither a `targetList` nor arms; and `larg` / `rarg` hold bare `SelectStmt` bodies rather than `{SelectStmt: ...}` wrappers.

### Result envelope

Both execution paths return one envelope: `{ data_view_results, data_view_metadata, data_view_fields, data_view_query_string }`. `data_view_fields` is the pg field descriptors in projection order, resolved to `{ name, data_type_oid, pg_type_name, data_type }` by `libs-server/data-views/resolve-pg-field-types.mjs` against `pg_catalog` — `format_type` plus `typcategory`, never `information_schema`, which cannot describe an expression and reports enums as `USER-DEFINED`. An unbucketable type throws rather than returning null.

**`data_view_fields` must never reach a client.** Raw pg descriptors carry `tableID` and `columnID` schema OIDs and the client merges `metadata` wholesale, so descriptors are deliberately not parked on `data_view_metadata`; the deriver emits `metadata.columns` from them server-side.

### Kill switch and audit

`libs-server/data-views/generation/data-view-sql-kill-switch.mjs` gates execution, because a saved view of this tier reaches the executor without passing through generation at all. The Redis key `data_view_sql:enabled` is the operational control and its absence means enabled; `LEAGUE_DATA_VIEW_SQL_DISABLED=1` is the control that still works when Redis does not.

`data_view_sql_audit` records one row per statement attempted — executed, rejected or errored — with the statement text, row count and duration.

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
