import db from '#db'
import { has_bridge, resolve as resolve_bridge } from '../identity-bridge-registry.mjs'
import {
  compute_measure_alias,
  is_batchable,
  register_measure
} from './measure-batch.mjs'

const game_period_key =
  "CONCAT(nfl_games.year, '_', nfl_games.week, '_', nfl_games.esbid)"
const season_period_key = "CONCAT(nfl_games.year, '_', nfl_games.seas_type)"

// `period='aggregate'` is the numerator-CTE grain used when a legacy
// denominator plugin owns the rate division. The CTE collapses to (pid|
// team_code, year) with measure_total = SUM(measure_expr) over all matched
// rows -- no period_key column. Joins 1:1 to outer, so multi-column queries
// don't cross-multiply (the bug per-period CTEs hit when two retrofitted
// columns each materialized their own per-(pid, period_key) CTE and the
// outer row count became prod of both, inflating SUMs).
const period_key_expr = (period) => {
  if (period === 'game') return game_period_key
  if (period === 'season') return season_period_key
  if (period === 'aggregate') return null
  throw new Error(`build_period_cte does not handle period: ${period}`)
}

// Source registry: declares how each measure source bridges to the
// canonical (pid|team_code, year, period_key, measure_total) shape that
// aggregator-rate / aggregator-count consume.
//
// - `table`: the leaf table the measure rows live in.
// - `team_col`: the column holding `team_code`; null disables team variant.
// - `pid_via`: how to emit `pid`. 'native' = source has `pid`. 'gsis_bridge'
//   = INNER JOIN player ON player.gsis_it_id = source.gsis_it_id; emits
//   player.pid.
// - `extra_join`: optional join applied before the (year, period_key)
//   grouping. Used by `plays_receiver` to bring in `nfl_plays` for the
//   `play_type='PASS'` predicate parity with the legacy per_player_route
//   denominator CTE.
const SOURCES = {
  plays: {
    table: 'nfl_plays',
    team_col: 'pos_team',
    pid_via: 'native_or_role'
  },
  gamelogs: {
    table: 'player_gamelogs',
    team_col: 'tm',
    pid_via: 'native'
  },
  snaps: {
    table: 'nfl_snaps',
    team_col: null,
    pid_via: 'gsis_bridge'
  },
  plays_receiver: {
    table: 'nfl_plays_receiver',
    team_col: null,
    pid_via: 'gsis_bridge',
    extra_join: (q) => {
      q.join('nfl_plays', function () {
        this.on('nfl_plays_receiver.esbid', '=', 'nfl_plays.esbid').andOn(
          'nfl_plays_receiver.playId',
          '=',
          'nfl_plays.playId'
        )
      })
    }
  },
  // role_union: one column-def attributes a single play row to multiple
  // pids via per-role UNION ALL. Each role contributes a `{ pid_column,
  // measure_expr }` tuple; build_period_cte materializes the inner UNION
  // ALL and groups by (pid, period_key, year). Used by
  // player_fantasy_points_from_plays where a play credits QB + receiver
  // simultaneously and a COALESCE(pid_columns) shape would drop one
  // attribution.
  plays_role_union: {
    table: 'nfl_plays',
    team_col: null,
    pid_via: 'role_union'
  }
}

const resolve_source = (measure_source) => {
  // Back-compat: undefined / unknown falls through to gamelogs (preserves
  // legacy `measure_source === 'plays' ? 'nfl_plays' : 'player_gamelogs'`
  // semantic).
  if (measure_source && SOURCES[measure_source]) return SOURCES[measure_source]
  return SOURCES.gamelogs
}

// Single-measure entrypoint. Thin wrapper over `build_batched_period_cte`
// that lifts the legacy `measure_expr` arg into a one-entry `measures` list
// emitting `SUM(measure_expr) AS measure_total`. Retained for role-union
// callers and as a back-compat surface; the batched path (used by the rate
// / count aggregators when they coalesce co-locatable measures) calls
// `build_batched_period_cte` directly with N entries.
export const build_period_cte = ({
  measure_source,
  measure_expr,
  measure_predicate,
  role_attributions,
  pid_columns,
  apply_filters,
  period,
  query_context,
  identity_id,
  params = {}
}) => {
  if (measure_source === 'plays_role_union') {
    return build_role_union_period_cte({
      measure_predicate,
      role_attributions,
      apply_filters,
      period,
      query_context,
      params
    })
  }
  return build_batched_period_cte({
    measure_source,
    measure_predicate,
    pid_columns,
    apply_filters,
    measures: [{ alias: 'measure_total', measure_expr }],
    period,
    query_context,
    identity_id,
    params
  })
}

const build_role_union_period_cte = ({
  measure_predicate,
  role_attributions,
  apply_filters,
  period,
  query_context,
  params
}) => {
  // Preserved verbatim from the legacy role-union branch. Role-union sources
  // build a per-role UNION ALL and are not batchable; see measure-batch.mjs
  // `BATCHABLE_SOURCES`.
  const source = SOURCES.plays_role_union
  const source_table = source.table
  const period_key = period_key_expr(period)
  const is_aggregate = period === 'aggregate'
  if (!role_attributions || !role_attributions.length) {
    throw new Error(
      `measure_source 'plays_role_union' requires role_attributions`
    )
  }
  const union_subs = role_attributions.map(
    ({ pid_column, measure_expr: role_measure_expr }) => {
      const sub = db(source_table)
        .select(db.raw(`${source_table}.${pid_column} AS pid`))
        .select(`${source_table}.esbid`)
        .select(db.raw(`${role_measure_expr} AS pts`))
        .whereRaw(`${source_table}.${pid_column} IS NOT NULL`)
      if (measure_predicate) sub.whereRaw(measure_predicate)
      if (query_context.year_range && query_context.year_range.length) {
        sub.whereIn(`${source_table}.year`, query_context.year_range)
      }
      // apply_filters (fp_apply_filters) filters nfl_plays.seas_type in each
      // inner sub. The outer innerJoin on nfl_games does not add a separate
      // nfl_games.seas_type predicate; the inner filter is the sole gate.
      // Both columns carry the same value per esbid (nfl_plays.seas_type ==
      // nfl_games.seas_type for any matched row), so the inner filter is
      // sufficient and consistent -- the outer nfl_games join provides the
      // year/period_key grouping columns only.
      if (apply_filters) apply_filters({ query: sub })
      return sub
    }
  )
  const inner_union = union_subs
    .slice(1)
    .reduce((acc, sub) => acc.unionAll(sub), union_subs[0])
  const include_year =
    !is_aggregate || query_context.splits.includes('year')
  const outer = db
    .from(inner_union.as('role_union'))
    .innerJoin('nfl_games', 'nfl_games.esbid', 'role_union.esbid')
    .select('role_union.pid AS pid')
    .select(db.raw('SUM(role_union.pts) AS measure_total'))
    .groupByRaw('"role_union"."pid"')
    .havingRaw('SUM(role_union.pts) > 0')
  if (include_year) {
    outer.select('nfl_games.year').groupByRaw('"nfl_games"."year"')
  }
  if (!is_aggregate) {
    outer
      .select(db.raw(`${period_key} AS period_key`))
      .groupByRaw(period_key)
  }
  if (query_context.year_range && query_context.year_range.length) {
    outer.whereIn('nfl_games.year', query_context.year_range)
  }
  // career_year / career_game: legacy with_func joined player_seasonlogs on
  // (pid, year, seas_type) and filtered between bounds. Mirror that here so
  // role-union numerators respect career_year params -- without this, the
  // per-game denominator (rate-type-per-game.mjs) correctly restricts to
  // career_year games while the numerator sums all-time, inflating the rate.
  const career_year = params && params.career_year
  const career_game = params && params.career_game
  if (career_year || career_game) {
    outer.innerJoin('player_seasonlogs', function () {
      this.on('player_seasonlogs.pid', '=', 'role_union.pid')
      this.andOn('player_seasonlogs.year', '=', 'nfl_games.year')
      this.andOn('player_seasonlogs.seas_type', '=', 'nfl_games.seas_type')
    })
    if (career_year) {
      const arr = Array.isArray(career_year) ? career_year : [career_year, career_year]
      const [lo, hi] = [Math.min(Number(arr[0]), Number(arr[1])), Math.max(Number(arr[0]), Number(arr[1]))]
      outer.whereBetween('player_seasonlogs.career_year', [lo, hi])
    }
    if (career_game) {
      const arr = Array.isArray(career_game) ? career_game : [career_game, career_game]
      const [lo, hi] = [Math.min(Number(arr[0]), Number(arr[1])), Math.max(Number(arr[0]), Number(arr[1]))]
      outer.whereBetween('player_seasonlogs.career_game', [lo, hi])
    }
  }
  return outer
}

// Coalesced builder: emits one CTE that selects multiple `SUM(<expr>) AS
// <alias>` columns over a single (source_table -> nfl_games) scan. Used by
// the rate / count aggregators when several measures share the same scan
// key (see measure-batch.mjs).
export const build_batched_period_cte = ({
  measure_source,
  measure_predicate,
  pid_columns,
  apply_filters,
  measures,
  period,
  query_context,
  identity_id,
  params = {}
}) => {
  const is_team = identity_id.startsWith('team')
  const period_key = period_key_expr(period)
  const base_source = resolve_source(measure_source)
  // For the `plays` source, params.team_unit selects which side of the play
  // the team grouping uses: 'def' groups by defender, otherwise offense
  // (pos_team). Mirrors the legacy `add_team_stats_play_by_play_with_statement`
  // semantics so team_unit='def' team-stat columns aggregate per defender.
  const team_col_override =
    measure_source === 'plays' && params?.team_unit === 'def'
      ? 'def'
      : base_source.team_col
  const source = { ...base_source, team_col: team_col_override }
  const source_table = source.table

  if (is_team && !source.team_col) {
    throw new Error(
      `measure_source '${measure_source}' does not support team identity`
    )
  }

  const is_aggregate = period === 'aggregate'

  if (source.pid_via === 'role_union') {
    throw new Error(
      'build_batched_period_cte does not handle role_union; route via build_period_cte'
    )
  }

  // pid expression resolution.
  // - 'native': source has a `pid` column.
  // - 'gsis_bridge': source carries gsis_it_id; INNER JOIN player to emit pid.
  // - 'native_or_role' (plays): `nfl_plays` has no pid; column-definition
  //   declares which per-play role columns (`trg_pid`, `bc_pid`, `psr_pid`,
  //   ...) participate via `pid_columns`. COALESCE them into a single key.
  let pid_expr
  let extra_player_join = false
  if (source.pid_via === 'native') {
    pid_expr = `${source_table}.pid`
  } else if (source.pid_via === 'gsis_bridge') {
    pid_expr = 'player.pid'
    extra_player_join = true
  } else {
    // native_or_role
    if (!pid_columns || !pid_columns.length) {
      pid_expr = `${source_table}.pid`
    } else if (pid_columns.length === 1) {
      pid_expr = `${source_table}.${pid_columns[0]}`
    } else {
      pid_expr = `COALESCE(${pid_columns
        .map((col) => `${source_table}.${col}`)
        .join(', ')})`
    }
  }

  const sub = db(source_table)

  if (source.extra_join) source.extra_join(sub)

  const include_year =
    !is_aggregate || query_context.splits.includes('year')
  sub.innerJoin('nfl_games', 'nfl_games.esbid', `${source_table}.esbid`)
  if (include_year) sub.select('nfl_games.year')
  if (!is_aggregate) {
    sub.select(db.raw(`${period_key} AS period_key`))
  }

  if (extra_player_join) {
    sub.innerJoin(
      'player',
      'player.gsis_it_id',
      `${source_table}.gsis_it_id`
    )
  }

  if (is_team) {
    sub.select(`${source_table}.${source.team_col} as team_code`)
  } else {
    sub.select(db.raw(`${pid_expr} AS pid`))
  }

  // One SUM(...) AS <alias> per measure. Single-measure callers pass one
  // entry with alias='measure_total' (legacy shape); batched callers pass
  // N entries with alias='m_<hash>' each. Identifiers in `alias` are
  // generated from md5 hashes and are safe to embed via db.raw.
  for (const { alias, measure_expr: m_expr } of measures) {
    sub.select(db.raw(`SUM(${m_expr}) AS ${alias}`))
  }
  sub.groupByRaw(is_team ? `${source_table}.${source.team_col}` : pid_expr)
  if (!is_aggregate) sub.groupByRaw(period_key)
  if (include_year) sub.groupByRaw('"nfl_games"."year"')

  if (measure_predicate) {
    sub.whereRaw(measure_predicate)
  }

  if (query_context.year_range && query_context.year_range.length) {
    sub.whereIn('nfl_games.year', query_context.year_range)
  }

  if (apply_filters) apply_filters({ query: sub })

  return sub
}

// Shared `add_cte` body for output-aggregator plugins. Idempotent on
// `applied_output_ctes`; aggregator-count and aggregator-rate differ only
// in `join_cte` / `emit_outer_select`, so the CTE construction and
// materialization are factored here.
// Ensure the split-identity bridges required by the join condition are
// materialized AND joined. The dispatcher at
// libs-server/get-data-view-results.mjs:1535-1546 calls `bridge.add_cte()`
// and pre-marks `applied_bridges` even when the from-table is non-player
// (so `bridge.join_cte()` at line 818-827 is skipped). This leaves the
// player_years CTE materialized but not joined to the main query -- our
// aggregator-rate / aggregator-count join clauses reference
// `player_years.year`, which fails 42P01 in Postgres.
//
// Track our own `joined_split_bridges` set so we add the inner-join exactly
// once per query, independent of the dispatcher's `applied_bridges` state.
const ensure_split_bridge_joined = ({ query_context, from, to }) => {
  if (!query_context.joined_split_bridges)
    query_context.joined_split_bridges = new Set()
  const key = `${from}->${to}`
  if (query_context.joined_split_bridges.has(key)) return
  const bridge = resolve_bridge(from, to)
  bridge.add_cte({ query_context })
  bridge.join_cte({ query_context })
  query_context.joined_split_bridges.add(key)
}

const ensure_split_bridges = ({ query_context, identity_id }) => {
  if (identity_id.startsWith('team')) return
  const { subject_id, splits } = query_context
  if (subject_id !== 'player') return
  if (splits.includes('year') && has_bridge('player', 'player_year')) {
    ensure_split_bridge_joined({
      query_context,
      from: 'player',
      to: 'player_year'
    })
  }
  if (
    splits.includes('week') &&
    has_bridge('player_year', 'player_year_week')
  ) {
    ensure_split_bridge_joined({
      query_context,
      from: 'player_year',
      to: 'player_year_week'
    })
  }
}

export const add_period_cte = async ({
  query_context,
  column_def,
  params,
  cte_name,
  group_key: caller_group_key,
  identity_id,
  period
}) => {
  ensure_split_bridges({ query_context, identity_id })
  const source = resolve_source(column_def.measure_source)
  // Batchable sources route into the measure-batch registry; the CTE is
  // materialized in a single `withMaterialized` call at flush time with one
  // `SUM(...) AS m_<hash>` column per registered measure. See measure-batch.mjs.
  if (is_batchable({ column_def }) && source.pid_via !== 'role_union') {
    const measure_alias = compute_measure_alias({
      column_def,
      params,
      identity_id
    })
    const measure_expr = column_def.measure_expr({
      table_name: source.table,
      params,
      identity_id
    })
    const common = {
      measure_source: column_def.measure_source,
      measure_predicate: column_def.measure_predicate
        ? column_def.measure_predicate({ params, identity_id })
        : null,
      pid_columns: column_def.pid_columns,
      apply_filters: column_def.apply_filters
        ? ({ query }) =>
            column_def.apply_filters({ query, params, identity_id })
        : null,
      period,
      identity_id,
      params
    }
    // Use the pre-hash group_key passed by the caller when available so that
    // the measure_batches map key is the canonical scan-signature object
    // (transparent for debugging). Fall back to cte_name for callers that do
    // not supply group_key (e.g. column-level output_aggregator overrides).
    const batch_group_key = caller_group_key ?? cte_name
    register_measure({
      query_context,
      group_key: batch_group_key,
      cte_name,
      measure_alias,
      measure_expr,
      common
    })
    return
  }
  // Legacy single-measure path for role_union (heterogeneous inner UNIONs
  // not eligible for batching).
  if (query_context.applied_output_ctes.has(cte_name)) return
  const role_attributions = await column_def.role_attributions({
    params,
    identity_id
  })
  const sub = build_period_cte({
    measure_source: column_def.measure_source,
    measure_expr: null,
    measure_predicate: column_def.measure_predicate
      ? column_def.measure_predicate({ params, identity_id })
      : null,
    role_attributions,
    pid_columns: column_def.pid_columns,
    apply_filters: column_def.apply_filters
      ? ({ query }) =>
          column_def.apply_filters({ query, params, identity_id })
      : null,
    period,
    query_context,
    identity_id,
    params
  })
  query_context.players_query.withMaterialized(cte_name, sub)
  query_context.applied_output_ctes.add(cte_name)
}
