# Data View CTE Builders

This directory contains the CTE builders that back data-view columns. Builders fall into two families:

- **Rate-type denominator CTEs** -- `rate-type/` subdirectory. One CTE per `rate_type` grain. See `rate-type/ABOUT.md`.
- **Stat-column CTEs** -- `add-player-stats-play-by-play-with-statement.mjs`, `add-team-stats-play-by-play-with-statement.mjs`, `add-defensive-play-by-play-with-statement.mjs`. One CTE per `fields-from-plays` column group. Also `player-fantasy-points-from-plays-column-definitions.mjs` and the `create_team_share_stat` builder in `player-stats-from-plays-column-definitions.mjs`, which register their own stat CTEs.

## Invariants for Authors

### Year Pushdown Contract

Every builder MUST apply `effective_years` as a `WHERE ... IN (...)` predicate on every year-partitioned table it scans (`nfl_plays`, `nfl_snaps`, `nfl_plays_receiver`, `player_gamelogs`, `nfl_games`, and the `defensive_plays` inner `nfl_plays` UNION branches) whenever `effective_years.length > 0`.

`effective_years` is computed as the sorted union of:

- `all_years`, derived from `decompose_nfl_weeks({ nfl_weeks: resolve_nfl_week_id_from_year_param(params) })`.
- `data_view_options.year_range`, populated from split-driven requests.

When adding a new builder or extending an existing one to scan a new year-partitioned table, add the corresponding `whereIn('<table>.year', effective_years)`. Skipping this silently disables Postgres partition pruning and the CTE scans every year partition.

For UNION-ALL subqueries (see `add-defensive-play-by-play-with-statement.mjs`), push the predicate inside each branch's inner `FROM nfl_plays` scan, not only on the outer wrapped subquery -- outer-query filters do not reach partition-pruning time.

### Materialization Invariant

Every stat or rate-type aggregation CTE MUST be registered via `query.withMaterialized(...)`, never `query.with(...)`. Predicates are always pushed at construction time in the builder, so the planner's predicate push-into-CTE is not needed. `withMaterialized` also prevents the planner from inlining the CTE into nested-loop plans that re-execute it per outer row (measured: 114x re-execution of a single stat CTE on a year-split view consumed ~6s before this invariant was established).

Split CTEs (`base_years`, `player_years`, `player_years_weeks`) remain inlineable via `.with(...)` because they are small and the planner handles them well.

### Forwarding data_view_options

Every `with:` handler (whether the direct builders in this directory or the inline `with:` functions on column definitions) MUST accept `data_view_options` and forward it into the `effective_years` computation. The dispatcher in `libs-server/get-data-view-results.mjs` already passes `data_view_options` to `with_func`; omitting it from the handler signature silently disables year pushdown for columns whose year signal comes only from splits.

## See Also

- `docs/data-views-system.md`, sections "Year Pushdown Contract for CTE-Based Columns" and "Materialization Policy for CTE-Based Columns".
- `rate-type/ABOUT.md` for rate-type-specific notes.
