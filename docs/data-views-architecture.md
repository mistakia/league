# Data Views Architecture

Reference for the primitives the data-view query builder is composed of. For request/response shapes, param semantics, caching, and the operational contracts (year pushdown, materialization policy), see [data-views-system.md](./data-views-system.md). This document covers structure: what the pieces are, how a request flows through them, and what to write when you add one.

Everything here lives under `libs-server/data-views/`, with the orchestrator at `libs-server/get-data-view-results.mjs` and the column registry at `libs-server/data-views-column-definitions/`.

## The two primitives

The system is built on two orthogonal ideas.

**Row grain** answers "what is one row?". A request declares `row_grain` (`['player']` or `['team']`) and `row_axes` (`[]`, `['year']`, or `['year','week']`). Together they resolve to exactly one **identity**, which is the row shape the query planner works in.

**Output aggregation** answers "how does one measure collapse into one cell?". A numeric column carries an `output` param of `{period, aggregation, threshold}`, and the output-aggregator registry resolves `(period, aggregation)` to a plugin that builds the per-period CTE and emits the outer SELECT.

These are independent. A per-game rate is the same aggregation whether the rows are players or teams; a team row grain is the same row shape whether the column is a raw sum or a threshold count.

## Identities

`libs-server/data-views/identities.mjs:26` declares six identities.

| Identity           | One row per             |
| ------------------ | ----------------------- |
| `player`           | pid                     |
| `player_year`      | (pid, year)             |
| `player_year_week` | (pid, year, week)       |
| `team`             | team code               |
| `team_year`        | (team code, year)       |
| `team_year_week`   | (team code, year, week) |

Each entry declares `key_columns`, its `row_grain` and `row_axes`, the four reference columns (`pid_column`, `team_column`, `year_column`, `week_column`), and a `from_source()` returning `{table, with}` — the FROM target plus the CTEs that must be attached to produce it. Team identities build their FROM from an inline `VALUES` CTE generated from `libs-shared/constants/nfl-teams-constants.mjs`; there is no `nfl_teams` master table.

`is_team_identity(identity_id)` at `identities.mjs:169` is the single source of truth for team-versus-player branching. Nothing carries an `is_team` flag.

`resolve_references({identity_id, from_table_name})` at `identities.mjs:194` produces the `pid_reference` / `team_reference` / `year_reference` / `week_reference` a query fragment should join against. It is FROM-aware: when sort optimization has picked a fact table as the FROM, references resolve to that table's own columns rather than the identity's canonical CTEs.

### Row-grain registry

`row-grain-registry.mjs` is a thin layer above identities. `row_grains` holds two entries, `row-grains/player.mjs` and `row-grains/team.mjs`, each declaring only data: `name`, `prefix_columns`, `position_filter_field`, `base_identity`. The team grain has `position_filter_field: null`.

`identity_for({row_grain_id, row_axes})` at `row-grain-registry.mjs:30` is the resolver — `player` plus a week axis gives `player_year_week`, and so on. This is the only place the `(grain, axes) → identity` mapping is expressed.

## Identity bridges

A bridge moves from one identity to another so a column declared at a different grain can attach. `identity-bridge-registry.mjs` keys them on `(from, to, mode)`, with `mode` defaulting to `'default'`.

Five bridges ship:

- `player-to-player-year.mjs` — the `player_years` CTE
- `player-year-to-player-year-week.mjs` — the `player_years_weeks` CTE
- `player-year-to-team-year.mjs` — the `player_year_teams` CTE, resolving each player's most-frequent team per year from `player_gamelogs` / `nfl_games`
- `team-to-team-year.mjs` — team codes crossed with the year range
- `team-year-to-team-year-week.mjs` — crossed with the canonical week set

Each module default-exports `{from, to, mode, add_cte, join_cte}`. Callers go through `apply_bridge({query_context, from, to, mode, params, source})` at `identity-bridge-registry.mjs:51`, which is idempotent against `query_context.applied_bridges` — a `Set` keyed `"<from>-><to>|<mode>"`. Bridge `add_cte` implementations guard separately against `query_context.registered_ctes` so a CTE registered by another path is not registered twice.

`resolve(from, to, mode)` throws when no bridge exists. That throw is the intended failure mode for a column whose grain cannot reach the active identity.

## Source attach

A column definition declares a `source` descriptor rather than a join. The source-attach registry turns `(cell identity, source grain, mode)` into the join predicate.

`source-attach/source-attach-registry.mjs` holds rules of the shape `{cell_identity, source_grain, mode, required_identity_bridges, emit_predicate}`. `source-attach/rules/index.mjs` registers six rule families:

- `identity-self.mjs` — every identity attaching to a source at its own grain
- `team-cell-to-team-source.mjs` — cross-grain team pairings
- `player-family-to-player.mjs`, `player-family-to-player-year.mjs`, `player-family-to-team.mjs`, `player-family-to-team-year.mjs`
- `matchup-opponent.mjs` — modes `matchup_opponent_current_week` and `matchup_opponent_next_week`

`source-attach/dispatcher.mjs:25` (`attach_source`) resolves the mode from `params.matchup_opponent_type`, looks up the rule, falls back to `'default'` mode when a non-default mode has no entry, applies every bridge named in `required_identity_bridges`, then emits the join via `rule.emit_predicate` unless the source sets `attach_owns_join`.

**Registry presence is the constraint mechanism.** The `matchup-opponent` family registers rules only for `player`, `player_year`, and `player_year_week` cell identities, which is why matchup-opponent columns are unavailable under the team grain — not because a column declares a restriction, but because resolution finds nothing.

`derive-granularity.mjs:16` returns a column's granularity from its `source.grain`. It is declarative: the coverage assertion reads it, the dispatcher does not.

## Column definition contract

A column definition declares what it measures and where the measure lives. The load-bearing fields:

- `source` — `{grain, table, attach, attach_owns_join, supports_row_axes, key_columns, extra_predicates, year_default, week_type}`. `grain` drives source-attach resolution.
- `measure` — the input contract, `{kind, expr, decimals}` where `kind` is `additive` or `distinct_count`.
- `supports_output` — `{periods: [...], aggregations: [...]}`. Presence of this field is the signal that the column supports output aggregation.
- `measure_expr({table_name, params, identity_id})`, `measure_source`, `measure_predicate`, `aggregate`, `decimals` — the derived output contract consumed by the aggregator plugins.
- `apply_filters` and `consumes_params_extra` — param handling for columns whose filters must reach inside the aggregation CTE.

`derive_measure({stat_name, measure, supports_periods})` at `measure-contract.mjs:67` is the factory that turns the input contract into the output contract. It validates the measure kind and expression at module load — a malformed declaration throws on import, not at query time. For `additive` it emits `SUM(expr)` with `aggregate: 'sum'`; for `distinct_count` it emits `COUNT(DISTINCT expr)` with `aggregate: 'count_distinct'`. It always prepends `game` and `season` to `supports_periods`, so a column declares only the periods beyond those two.

`measure_source` selects the scan: `plays`, `gamelogs`, `snaps`, `plays_receiver`, or `plays_role_union`.

Ratio columns (`has_numerator_denominator: true`) declare no `supports_output`. `SUM(measure) / COUNT(period)` is not meaningful for them and no `ratio` aggregator exists.

## Output aggregation

`output-aggregator-registry.mjs` is a `Map<period, Map<aggregation, plugin>>`.

Registered periods for `rate`: `game`, `team_play`, `team_pass_play`, `team_rush_play`, `team_half`, `team_quarter`, `team_drive`, `team_series`, `player_rush_attempt`, `player_pass_attempt`, `player_target`, `player_catchable_target`, `player_deep_target`, `player_catchable_deep_target`, `player_reception`, `player_touch`, `player_opportunity`, `player_play`, `player_pass_play`, `player_rush_play`, `player_route`.

Registered periods for `count`: `game` and `season`. There is no `(season, 'rate')` tuple.

### Plugin interface

- `consumes_params` — a declarative allowlist of param keys the plugin reads. This is not optional and is not inferred. It feeds the CTE-name hash, so **omitting a key here makes two columns that differ only in that param collapse into one shared CTE and return identical values.** Every historical bug of that shape traces to a missing entry.
- `get_cte_name({..., dispatch_params})`
- `add_cte` — registers via `withMaterialized`, never `with`
- `join_cte` — joins using identity-derived references
- `emit_outer_select` — returns `{sql, bindings}`

`aggregator-rate.mjs` emits `SUM(measure) / NULLIF(COUNT(period_key), 0)`, rounded when the column declares `decimals`. `aggregator-count.mjs` emits `COUNT(DISTINCT period_key) FILTER (WHERE measure <op> ?)`, so the threshold applies to the aggregated per-period total rather than to individual rows. It requires `params.output.threshold`.

`apply_output_aggregator` at `output-aggregator-registry.mjs:176` orchestrates a column: resolve the plugin, name the CTE, add it, join it (deduped against `query_context.joined_output_ctes`), attach a separate numerator CTE when the plugin does not handle its own numerator, then emit the outer SELECT. A column definition can override registry resolution with `column_def.output_aggregator`.

### Period CTE construction

`output-aggregator/build-period-cte.mjs` builds the per-period scan. Three period modes, keyed by `period_key_expr`:

- `game` — `period_key` is `CONCAT(season_year,'_',week,'_',esbid)`
- `season` — `period_key` is `CONCAT(season_year,'_',season_type)`
- `aggregate` — no period key; collapses to (pid or team, year) for the numerator-only path

Anything else throws.

Two builders sit behind it. `build_role_union_period_cte` handles `measure_source: 'plays_role_union'`, where one play attributes to several players — a touchdown pass scores both the passer and the receiver. It builds a `UNION ALL` over role attributions, each with its own pid column and measure expression. Fantasy points is the motivating case; a single-pid `COALESCE` shape cannot express it.

`build_batched_period_cte` handles everything else and is the coalescing path: measures that share a scan signature become one materialized CTE emitting `SUM(expr) AS m_<hash>` per measure.

### Measure batching

`output-aggregator/measure-batch.mjs:39` computes the batch key from `measure_source`, `period`, `identity_id`, sorted `pid_columns`, the rendered `measure_predicate`, the `apply_filters` body, `team_unit`, and the consumed-params signature. Measures sharing a key share one `nfl_plays` scan named `rate_<period>_<md5 prefix>`.

`plays_role_union` is excluded from batching. Registration is deferred — `register_measure` accumulates into `query_context.measure_batches` and `flush_measure_batches` materializes after the per-column dispatch loop completes, so batching can see every column before deciding.

This is a real correctness/performance tension. Including a param in `consumes_params` fragments the batch and costs scans; omitting it silently merges columns that should differ. Correctness wins — see the year-offset and week entries in the migration history.

## Legacy `rate_type` compatibility

`rate_type` is **permanently accepted on the request path.** Shared short URLs carry it and cannot be rewritten, so this is not a deprecation window.

`libs-shared/data-views-output-tokens.mjs` holds `RATE_TYPE_TO_OUTPUT`, the canonical token table, and `translate_rate_type_to_output`. It also exports `NON_PLAY_LEVEL_PERIODS` and `is_play_level_period`, consumed by the column-param UI.

`libs-server/data-views/normalize-output-param.mjs:15` translates a legacy `rate_type` to `output` when no `output` is present, and enforces two row-axis rules: under a `week` axis it silently drops `{period: 'game', aggregation: 'rate'}` (the per-game denominator is always 1 at week grain) and throws on `{period: 'season', aggregation: 'count'}`. `normalize_columns` applies it across `columns`, `prefix_columns`, and `where`.

Saved views stored before the cutover are migrated by `libs-shared/data-views-saved-view-migration.mjs`, applied server-side by `scripts/migrate-data-views-saved.mjs` and on localStorage restore by `app/core/data-views/browser-storage.mjs`.

## Query context

`query-context.mjs:9` (`build_query_context`) returns the struct threaded through the whole build: `db`, `players_query`, `identity_id`, `row_grain_id`, `row_grain`, `row_axes`, `year_range`, `nfl_week_ids`, `params`, the four references, `is_team`, `position_filter_sql`, `having_clauses`, and four idempotency sets — `applied_bridges`, `applied_output_ctes`, `joined_output_ctes`, `registered_ctes`.

Later stages attach `data_view_options`, `week_range`, `measure_batches`, `joined_split_bridges`, and the `player_year_teams` CTE name and year range.

`query_context` is the identity-derived source of truth. `data_view_options` survives as the FROM-table-aware override layer, because sort optimization can pick a fact table as the FROM and the references then have to point at that table.

## Request flow

`get_data_view_results_query` in `libs-server/get-data-view-results.mjs`:

1. Validate table state and row-grain compatibility.
2. Prune null and empty where-clause values.
3. Normalize params, then translate legacy `rate_type` to `output` across columns, prefix columns, and where.
4. Choose the FROM table. `get_from_table_config` may promote a sort column's fact table to the FROM as an optimization, constrained to identity-compatible candidates.
5. Build `data_view_options` and `query_context`.
6. Attach matchup-opponent CTEs when a player identity is active.
7. Apply the year and week identity bridges for the active row axes.
8. Wire the FROM clause and identity CTE joins.
9. Resolve the FROM-aware reference mirror.
10. Accumulate cache info across where clauses and columns.
11. Dispatch the output aggregator for every column carrying `params.output`.
12. Flush batched measure CTEs and per-team-play wraps.
13. Group clauses by table and by supported row axes; order year-split tables last.
14. Emit per-table clauses, attaching sources for columns not handled by an aggregator.
15. Add row-axis SELECT and GROUP BY entries.
16. Inject participation status for week-grain player views.
17. Resolve ORDER BY, assemble WHERE / HAVING / GROUP BY, apply LIMIT and OFFSET.

## Adding things

**A column.** Declare `source` with the grain its data actually lives at, and `measure` with the kind and expression. Run it through `derive_measure` if it is a numeric measure so the output contract is generated rather than hand-written. Confirm a source-attach rule exists for `(cell identity, your grain)` for every grain you expect the column to be usable at — the coverage assertion checks this.

**A row grain.** Add its identities to `identities.mjs` with `from_source` resolvers, add the row-grain module under `row-grains/`, extend `identity_for` in `row-grain-registry.mjs`, and register bridges from the new base identity to its axis variants. Then add source-attach rules for the new cell identities; without them, every existing column will fail to resolve.

**A bridge.** One kebab-case file under `identity-bridges/` named `<from>-to-<to>.mjs`, default-exporting `{from, to, mode, add_cte, join_cte}`, registered in `identity-bridge-registry.mjs`. Register the CTE with `withMaterialized` and guard on `query_context.registered_ctes`.

**An output aggregator.** One file under `output-aggregator/` implementing the five-member interface. Declare `consumes_params` exhaustively — enumerate every param that changes the CTE's contents, not just the ones that feel significant. Register the `(period, aggregation)` tuples in `output-aggregator-registry.mjs`.

## Gates

- `test/libs-server.data-view-queries.mjs` — 247 golden fixtures under `test/data-view-queries/`, compared as generated SQL. The primary regression gate.
- `test/libs-server.data-view-queries-result-equivalence.mjs` — executed-result equivalence, for semantics the golden SQL comparison cannot see.
- `test/libs-server.data-views-column-coverage.spec.mjs` — every column derives a non-empty granularity over known identities, every `*_from_plays` column declares week-axis support, and every admitted column has a source-attach rule for its grain.
- `test/data-views-subject-compatibility.spec.mjs` — a player-grain column used under the team grain raises `ColumnRowGrainMismatch`, as a display column, a prefix column, and a where clause.
- `test/data-views-output-parity.spec.mjs` — legacy `rate_type` and native `output` inputs produce identical SQL, across six column families.
- `test/data-views.output-aggregator.spec.mjs` — count FILTER semantics, period keying, materialization and year pushdown, per-instance CTE identity for `year` and `year_offset`, and the week-axis sanitization rules.
- `test/data-views.measure-contract.spec.mjs` — `derive_measure` for both measure kinds.
- `db/adhoc/check-data-view-sql-validity.mjs` — sweeps every column across every admitted row grain, row-axis combination, and two param shapes, and runs `EXPLAIN` against a throwaway database. Not in CI; run it manually as a gate before any grain or column-name cutover.

## See also

- [data-views-system.md](./data-views-system.md) — request/response shapes, param semantics, caching, year pushdown and materialization contracts
- [query-builder-function-reference.md](./query-builder-function-reference.md) — function-level reference
- `libs-server/data-views/ABOUT.md` and the per-directory `ABOUT.md` files — invariants for CTE-builder authors
