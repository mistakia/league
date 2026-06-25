# Rate-Type CTE Builders

This directory contains the CTE builders that produce the denominator (rate-type) aggregations used by data-view columns. Each file targets a specific aggregation grain and is plugged into the rate-type dispatcher in `./index.mjs`.

## Files

- `rate-type-per-game.mjs` -- per-game denominators over `player_gamelogs` (+ `nfl_games`) for player variants, and over `nfl_plays` for team variants.
- `rate-type-per-player-play.mjs` -- per-player-play denominators over `nfl_plays` joined with `nfl_snaps`.
- `rate-type-per-team-play.mjs` -- per-team-play denominators over `nfl_plays`.
- `rate-type-per-player-route.mjs` -- per-player-route denominators over `nfl_plays_receiver` joined with `nfl_plays`.
- `rate-type-per-player.mjs` -- per-player stat-counted denominators over `nfl_plays` (rush/pass/target/reception variants).
- `index.mjs` -- dispatcher mapping `rate_type` strings to `{ get_cte_table_name, add_cte, join_cte }` handlers.

## Invariants for Authors

### Year Pushdown Contract

Every builder MUST apply `effective_years` as a `WHERE ... IN (...)` predicate on every year-partitioned table it scans (for example `nfl_plays`, `nfl_snaps`, `nfl_plays_receiver`, `player_gamelogs`, `nfl_games`) whenever `effective_years.length > 0`.

`effective_years` is computed as the sorted union of:

- `all_years`, derived from `decompose_nfl_weeks({ nfl_weeks: resolve_nfl_week_id_from_year_param(params) })`.
- `data_view_options.year_range`, populated from split-driven requests.

When adding a new builder or extending an existing one to scan a new year-partitioned table, add the corresponding `whereIn('<table>.year', effective_years)`. Skipping this silently disables Postgres partition pruning and the CTE scans every year partition.

### Materialization Invariant

Every builder MUST register its CTE via `players_query.withMaterialized(...)`, never `players_query.with(...)`. Predicates are always pushed at construction time in the builder, so the planner's predicate push-into-CTE is not needed. `withMaterialized` also prevents the planner from inlining the CTE into nested-loop plans that re-execute it per outer row.

### Forwarding data_view_options

Column definitions that call these builders directly (rather than via `add_rate_type_cte`) MUST forward `data_view_options` into the builder call. The builder depends on `data_view_options.year_range` to compute `effective_years` in the row-axis-driven case; omitting it silently disables year pushdown for columns whose year signal comes only from row_axes.

## See Also

- `../ABOUT.md` generalizes these invariants to the stat-column CTE builders.
- `docs/data-views-system.md`, sections "Year Pushdown Contract for CTE-Based Columns" and "Materialization Policy for CTE-Based Columns".
