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

### Seas-Type Pushdown Contract

`seas_type` is the canonical season-type filter. `resolve_nfl_week_id_from_year_param` defaults `seas_type` to `['REG']` when unset, so the `nfl_week_id` IN-list produced by year-only callers covers only REG weeks. `apply_play_by_play_column_params_to_query` decomposes the IN-list via `decompose_nfl_weeks` and always emits `whereIn('<table>.seas_type', seas_types)` alongside the year predicate -- this engages the `(year, seas_type, ...)` composite indexes on `nfl_plays` and matches the partition layout. The `nfl_week_id IN (...)` predicate itself is emitted only when `is_full_year_seas_type_coverage` returns false (user narrowed to specific weeks within a season type); otherwise the redundant IN-list is dropped.

Builders that scan `nfl_plays` / `nfl_games` outside `apply_play_by_play_column_params_to_query` must follow the same pattern: decompose the resolved `nfl_week_id` list to `{years, seas_types}` and emit the derived `seas_type IN (...)` predicate alongside the year predicate, gating the `nfl_week_id IN (...)` clause on `!is_full_year_seas_type_coverage(...)`. Skipping the `seas_type` predicate silently re-admits PRE / POST plays and defeats the composite-index access path.

### Correlated Subquery Inner-FROM Contract

`select-string.mjs` emits a correlated `(SELECT SUM(...) FROM ...)` for columns invoked with a `year_offset` range. The inner `FROM` must name a relation that resolves in the subquery's own scope -- Postgres does not expose outer FROM-clause aliases (hashed `tXXXX` aliases bound via `INNER JOIN <source.table> AS tXXXX`) as relations to subqueries; only their columns are correlatable.

Rule for column-definition authors:

- Sources declared with `source.table` (real-table joins like `player_adp_index`) are re-scanned inside the subquery directly from `source.table`. The discriminator predicates the outer JOIN applies (year-set from `source.year_default` x `year_offset`, plus `source.extra_predicates`) are reapplied inside the subquery -- the alias's predicates are not visible to the inner scope. If you add a new discriminator (year-tag, format-hash, etc.), wire it through `source.extra_predicates` or `source.year_default` so the emitter reapplies it; don't bolt it onto the outer JOIN via a custom `source.attach` and assume the inner subquery inherits it.
- Sources declared with `source.attach` (CTE-backed) keep the outer relation name in the inner `FROM`. CTE names are visible throughout the WITH block, so this is well-defined; the CTE builder must have already restricted to the offset year range upstream (Year Pushdown Contract above).

### year_offset Single-Application Invariant

`year_offset` is applied to a given `nfl_week_id` list exactly once. `resolve_nfl_week_params` (`get-data-view-results.mjs`) bakes the offset into an explicit list and sets `params.year_offset_applied_to_nfl_week_id`; `resolve-view-scope.mjs` re-applies `year_offset` only to lists lacking that marker (year-derived and internally-built lists, which arrive unshifted). Re-applying to an already-shifted list double-shifts the window to `base + 2*offset` while the outer join shifts by `1*offset`, silently dropping the bottom offset-cohort of base years. See `docs/data-views-system.md` "Single-application invariant".

### Materialization Invariant

Every stat or rate-type aggregation CTE MUST be registered via `query.withMaterialized(...)`, never `query.with(...)`. Predicates are always pushed at construction time in the builder, so the planner's predicate push-into-CTE is not needed. `withMaterialized` also prevents the planner from inlining the CTE into nested-loop plans that re-execute it per outer row (measured: 114x re-execution of a single stat CTE on a year-split view consumed ~6s before this invariant was established).

Split CTEs (`base_years`, `player_years`, `player_years_weeks`) remain inlineable via `.with(...)` because they are small and the planner handles them well.

### Forwarding data_view_options

Every `with:` handler (whether the direct builders in this directory or the inline `with:` functions on column definitions) MUST accept `data_view_options` and forward it into the `effective_years` computation. The dispatcher in `libs-server/get-data-view-results.mjs` already passes `data_view_options` to `with_func`; omitting it from the handler signature silently disables year pushdown for columns whose year signal comes only from splits.

### Granularity Declaration

Every column definition declares the identity ids it is compatible with. The declaration is declarative-only today (validated by `test/libs-server.data-views-column-coverage.spec.mjs`; no runtime consumer reads it yet). Authoring rule:

- The column's `source.grain` is the canonical declaration. The four observed grains (`player`, `player_year`, `team`, `team_year`) are themselves valid identity ids, so the helper `derive-granularity.mjs` defaults `granularity` to `[source.grain]`.
- Set `granularity:` explicitly on a column only when its compatible identity-id set diverges from the `source.grain` default (e.g. season-only views of a finer-grain source).

Adding `granularity` to every column manually is unnecessary; the helper does the derivation. Set `source.grain` correctly on the source descriptor and the spec is satisfied.

## Helpers

- `get-param-option-counts.mjs` -- load when working on column-param metadata or live filter previews. Computes `{ [serialize_preset_value]: count }` pivots for `OBJECT_PRESET` params by applying every active `nfl_plays_column_params` predicate from `table_state.where[*].params` _except_ the targeted param, with a 10s `statement_timeout` fallback to `{ counts: {} }`.

## See Also

- `docs/data-views-system.md`, sections "Year Pushdown Contract for CTE-Based Columns", "Materialization Policy for CTE-Based Columns", and "Param Option Counts".
- `rate-type/ABOUT.md` for rate-type-specific notes.
