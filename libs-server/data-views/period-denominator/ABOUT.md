# Rate-Type CTE Builders

This directory contains the CTE builders that produce the denominator aggregations used by data-view columns. Each file targets a specific aggregation grain and is bound to its `(period, 'rate')` tuples by `../output-aggregator-registry.mjs`.

These are the live implementation, not a compat shim — the directory keeps its `rate-type` name only because renaming it has not been done yet (`user:task/league/data-views/retire-rate-type-compat-shims.md`). The `rate_type` request param is separately permanent, since shared short URLs carry it; `../normalize-output-param.mjs` translates it to `output` before any of these builders run.

## Files

- `rate-type-per-game.mjs` -- per-game denominators over `player_gamelogs` (+ `nfl_games`) for player variants, and over `nfl_plays` for team variants.
- `rate-type-per-player-play.mjs` -- per-player-play denominators over `nfl_plays` joined with `nfl_snaps`.
- `rate-type-per-team-play.mjs` -- per-team-play denominators over `nfl_plays`.
- `rate-type-per-player-route.mjs` -- per-player-route denominators over `nfl_plays_receiver` joined with `nfl_plays`.
- `rate-type-per-player.mjs` -- per-player stat-counted denominators over `nfl_plays` (rush/pass/target/reception variants).
- `emit-rate-outer-select.mjs` -- shared outer-SELECT emission for the legacy rate path.
- `per-team-play-wrap.mjs` -- the multi-year-no-split wrap that re-attributes per-year team volume.

Dispatch lives one level up in `../output-aggregator-registry.mjs`, which resolves `(period, aggregation)` to a plugin exposing `get_cte_name`, `add_cte`, `join_cte`, and `emit_outer_select`. There is no `index.mjs` here.

These plugins do NOT declare `consumes_params`. That is the `output-aggregator/` interface, where it feeds `consumed_params_signature` for the count and rate aggregators. Here each plugin names its own CTE by hashing the params it actually resolves — see `get_per_player_cte_table_name`, which folds in the play-level denominator params — so a `consumes_params` list would be inert. Five of them were, until 2026-08-19: declared, plumbed through the registry adapter, and read by nothing.

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

Column definitions that call these builders directly (rather than through the output-aggregator registry) MUST forward `data_view_options` into the builder call. The builder depends on `data_view_options.year_range` to compute `effective_years` in the row-axis-driven case; omitting it silently disables year pushdown for columns whose year signal comes only from row_axes.

## See Also

- `../ABOUT.md` generalizes these invariants to the stat-column CTE builders.
- `docs/data-views-system.md`, sections "Year Pushdown Contract for CTE-Based Columns" and "Materialization Policy for CTE-Based Columns".
