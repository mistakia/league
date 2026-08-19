# Period Denominator CTE Builders

This directory contains the CTE builders that produce the per-period denominator aggregations used by data-view columns under the `rate` output aggregation. Each module targets one denominator FAMILY and is bound to its `(period, 'rate')` tuples by `../output-aggregator-registry.mjs`.

Nothing here is a compat shim. `rate_type` survives on the REQUEST path only — shared short URLs carry it permanently, so `../normalize-output-param.mjs` translates it to `output` before any builder runs, and the server normalizes the legacy param keys at the request boundary.

## Files

- `per-game.mjs` — per-game denominators over `player_gamelogs` (+ `nfl_games`) for player variants, and over `nfl_games` (home/away union) for team variants.
- `per-player-play.mjs` — per-player-play denominators over `nfl_plays` joined with `nfl_snaps`.
- `per-team-play.mjs` — per-team-play denominators over `nfl_plays`.
- `per-player-route.mjs` — per-player-route denominators over `nfl_plays_receiver` joined with `nfl_plays`.
- `per-player.mjs` — per-player stat-counted denominators over `nfl_plays` (rush/pass/target/reception variants).
- `emit-rate-outer-select.mjs` — the outer-SELECT emission all five plugins share as their `emit_outer_select`.
- `per-team-play-wrap.mjs` — the multi-year-no-split wrap that re-attributes per-year team volume, flushed by `libs-server/get-data-view-results.mjs`.

## Dispatch

Dispatch lives one level up in `../output-aggregator-registry.mjs`, which resolves `(period, aggregation)` to a plugin exposing `get_cte_name`, `add_cte`, `join_cte` and `emit_outer_select`, plus the optional `handles_numerator` hook that suppresses the standard `aggregator-rate` numerator path when a plugin materializes its own. There is no `index.mjs` here and no single entry point.

**A module name tracks the denominator family, not a period token.** The registry is module-keyed: it registers 19 `(period, 'rate')` tuples across five plugins, capturing `dispatch_params` in the registration closure. `per-team-play.mjs` serves seven tokens (`team_play`, `team_pass_play`, `team_rush_play`, `team_half`, `team_quarter`, `team_drive`, `team_series`) and `per-player.mjs` serves nine, so naming a module per token was never possible.

Four column-definition files plus `../participation-status-cte.mjs` and `../register-per-game-cte.mjs` import these modules directly rather than through the registry; those call sites carry the `data_view_options` obligation below.

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
