import db from '#db'
import {
  has_bridge,
  resolve as resolve_bridge
} from '../identity-bridge-registry.mjs'
import {
  compute_measure_alias,
  is_batchable,
  register_measure
} from './measure-batch.mjs'
import { normalize_career_year_range } from '../param-utils.mjs'
import { apply_scope_to_query } from '../apply-scope-to-query.mjs'
import {
  physical_has_nfl_week_id,
  physical_has_seas_type,
  physical_seas_type_column,
  physical_year_column,
  physical_year_projection
} from '../physical-season-columns.mjs'
import {
  FACT_SOURCES,
  resolve_fact_source,
  subject_id_expression
} from '../measure/fact-source-registry.mjs'
import { render_measure_sql } from '../measure/measure-contract.mjs'

const game_period_key =
  "CONCAT(nfl_games.season_year, '_', nfl_games.week, '_', nfl_games.esbid)"
// A season is partitioned by the YEAR alone. season_type filters which games
// are in scope; it does not divide the span, so keying on it counted
// (year, season type) PAIRS while COUNT_PERIOD_OPTIONS labelled them
// "Seasons". It read correct only because seas_type defaults to ['REG'] -- a
// request widening it to REG and POST doubled every count.
const season_period_key = 'nfl_games.season_year'

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

// Emit view scope against a PHYSICAL fact relation, qualified by the alias it
// is reachable under.
//
// The nfl_games join carries the scope already, but it joins on esbid alone, so
// the planner cannot infer the fact table's season_year from it and scans every
// partition: a single-year Wide Receiver Overview read all 26 nfl_plays
// partitions and every player_gamelogs partition, 2.6M intermediate rows and
// ~12s of a 16.1s run (signal 126307). The predicate belongs on the fact scan
// for the same reason add-player-stats-play-by-play-with-statement.mjs puts it
// there, and it is the SAME effective scope, so it narrows nothing.
//
// Which scope columns exist and what they are called are properties of the
// PHYSICAL table (player_gamelogs carries season_year and neither a season type
// nor an nfl_week_id), while the predicate has to be qualified by the ALIAS --
// the cohort expansion joins player_gamelogs as `pg`, so the two differ and
// resolving the columns off the alias would emit the vocabulary names.
const apply_scope_to_fact_relation = ({
  query,
  table_name,
  alias = null,
  query_context,
  params
}) => {
  const has_season_type = physical_has_seas_type(table_name)
  const scope_table_name = alias || table_name
  apply_scope_to_query({
    query,
    table_name: scope_table_name,
    query_context,
    column_params: params,
    has_season_type,
    has_nfl_week_id: physical_has_nfl_week_id(table_name),
    season_year_column: physical_year_column(table_name),
    season_type_column: has_season_type
      ? physical_seas_type_column(table_name)
      : null
  })
}

// This builder no longer owns the source table: which table a measure's facts
// live in, how a fact attributes to a subject and where the subject id is read
// from are declared in `measure/fact-source-registry.mjs`. What stays here is
// the scan -- bridging a source to the canonical
// (pid|team_code, year, period_key, measure_total) shape that aggregator-rate
// and aggregator-count consume.
//
// A `multi_role` source attributes ONE fact row to several subjects, so each
// role contributes a `{ pid_column, measure_expr }` tuple -- or, when the
// credited player is not named by any column on the fact table, a
// `{ pid_expr, apply_joins, measure_expr }` tuple that reaches the table which
// does name them. `build_period_cte` materializes the inner UNION ALL and
// groups by (pid, period_key, year). A role may additionally declare
// `game_aggregates` -- see the per-game stage in
// `build_role_union_period_cte` below.

// Single-measure entrypoint. Thin wrapper over `build_batched_period_cte`
// that lifts the legacy `measure_expr` arg into a one-entry `measures` list
// emitting `SUM(measure_expr) AS measure_total`. Retained for role-union
// callers and as a back-compat surface; the batched path (used by the rate
// / count aggregators when they coalesce co-locatable measures) calls
// `build_batched_period_cte` directly with N entries.
export const build_period_cte = ({
  measure_source,
  measure_expr,
  accumulator_selects = null,
  measure_predicate,
  role_attributions,
  game_conditional_expr,
  role_columns,
  apply_filters,
  period,
  query_context,
  identity_id,
  params = {},
  aggregate = 'sum',
  force_year_grain = false
}) => {
  if (measure_source === 'plays_role_union') {
    return build_role_union_period_cte({
      measure_predicate,
      role_attributions,
      game_conditional_expr,
      apply_filters,
      period,
      query_context,
      params,
      force_year_grain
    })
  }
  return build_batched_period_cte({
    measure_source,
    measure_predicate,
    role_columns,
    apply_filters,
    measures: [
      accumulator_selects
        ? { accumulator_selects }
        : { alias: 'measure_total', measure_expr, aggregate }
    ],
    period,
    query_context,
    identity_id,
    params,
    force_year_grain
  })
}

// The per-game stage. `role_attributions` emits one row per PLAY, so grouping
// it straight to period grain can only express measures that are a plain SUM of
// per-play values. Every non-linear scoring rule is a condition on a PLAYER-GAME
// aggregate -- a 300-yard passing milestone, a DST points-against threshold --
// and there is no grain at which the outer aggregate can evaluate one.
//
// A role declares `game_aggregates: { <alias>: <per_play_expr> }`; the column
// def declares `game_conditional_expr`, a SQL expression over those aliases
// evaluated ONCE per (pid, esbid) and added to the summed per-play points. So
// the shape becomes: sum per play -> group per game, evaluate conditions ->
// group to period grain.
//
// The stage is emitted ONLY when something declares an aggregate or a
// conditional. A column with neither gets the previous single-level aggregate
// character for character, which is what keeps the 248 goldens from moving --
// and is also correct on the merits, since an extra HashAggregate over a scan of
// nfl_plays buys nothing for a measure that is linear in the plays.
//
// The stage carries the `role_union` alias so the nfl_games join and the
// career_year / career_game joins below reference it unchanged; the inner union
// takes `role_plays`.
const build_role_union_period_cte = ({
  measure_predicate,
  role_attributions,
  game_conditional_expr,
  apply_filters,
  period,
  query_context,
  params,
  force_year_grain = false
}) => {
  // Multi-role sources build a per-role UNION ALL and are not batchable; see
  // measure-batch.mjs `is_batchable`.
  const source = FACT_SOURCES.plays_role_union
  const source_table = source.table
  const period_key = period_key_expr(period)
  const is_aggregate = period === 'aggregate'
  if (!role_attributions || !role_attributions.length) {
    throw new Error(
      `measure_source 'plays_role_union' requires role_attributions`
    )
  }
  // Union of every alias any role declares. Each arm must project all of them
  // in the same order for the UNION ALL to be compatible, so a role that
  // sources none of a given aggregate contributes a literal 0 -- which is also
  // the arithmetically correct contribution to the per-game sum.
  const game_aggregate_aliases = [
    ...new Set(
      role_attributions.flatMap(({ game_aggregates }) =>
        Object.keys(game_aggregates || {})
      )
    )
  ]
  const has_game_stage = Boolean(
    game_aggregate_aliases.length || game_conditional_expr
  )
  const union_subs = role_attributions.map(
    ({
      pid_column,
      pid_expr,
      apply_joins,
      measure_expr: role_measure_expr,
      game_aggregates
    }) => {
      // A role normally names a pid column on the source table. A role whose
      // player is not identified by any column on nfl_plays (the fumble roles,
      // sourced from nfl_play_stats) instead supplies `pid_expr` plus
      // `apply_joins` to reach the table that does identify them. `pid_expr` is
      // a function of the base relation so it can reference columns on it.
      const pid_reference = pid_expr
        ? pid_expr({ plays_table: source_table })
        : `${source_table}.${pid_column}`
      const sub = db(source_table)
        .select(db.raw(`${pid_reference} AS pid`))
        .select(`${source_table}.esbid`)
        .select(db.raw(`${role_measure_expr} AS pts`))
      for (const alias of game_aggregate_aliases) {
        const expr = (game_aggregates && game_aggregates[alias]) || '0'
        sub.select(db.raw(`${expr} AS ${alias}`))
      }
      if (apply_joins) apply_joins({ query: sub, plays_table: source_table })
      sub.whereRaw(`${pid_reference} IS NOT NULL`)
      if (measure_predicate) sub.whereRaw(measure_predicate)
      // Emit view-scope (year + seas_type + optional nfl_week_id) on the inner
      // sub against the source table. nfl_plays carries seas_type / nfl_week_id
      // alongside year, so partition pruning + composite indexes engage from a
      // single emission. The outer nfl_games join below adds matching predicates
      // (defense in depth) without depending on apply_filters to gate season type.
      // source_table is the PHYSICAL nfl_plays here, not a CTE alias, so the
      // conformed column names resolve through physical-season-columns.
      apply_scope_to_fact_relation({
        query: sub,
        table_name: source_table,
        query_context,
        params
      })
      if (apply_filters) apply_filters({ query: sub })
      return sub
    }
  )
  const inner_union = union_subs
    .slice(1)
    .reduce((acc, sub) => acc.unionAll(sub), union_subs[0])
  let outer_source = inner_union
  if (has_game_stage) {
    outer_source = db
      .from(inner_union.as('role_plays'))
      .select('role_plays.pid AS pid')
      .select('role_plays.esbid AS esbid')
      .select(db.raw('SUM(role_plays.pts) AS pts'))
      .groupByRaw('"role_plays"."pid"')
      .groupByRaw('"role_plays"."esbid"')
    for (const alias of game_aggregate_aliases) {
      outer_source.select(db.raw(`SUM(role_plays.${alias}) AS ${alias}`))
    }
  }
  // A conditional fires once per player-game, so it is added INSIDE the outer
  // SUM rather than beside it -- at season grain that sums one milestone per
  // qualifying game, which is the whole point of the stage.
  const measure_sql = game_conditional_expr
    ? `SUM(role_union.pts + (${game_conditional_expr}))`
    : 'SUM(role_union.pts)'
  const include_year =
    !is_aggregate || query_context.row_axes.includes('year') || force_year_grain
  const outer = db
    .from(outer_source.as('role_union'))
    .innerJoin('nfl_games', 'nfl_games.esbid', 'role_union.esbid')
    .select('role_union.pid AS pid')
    .select(db.raw(`${measure_sql} AS measure_total`))
    .groupByRaw('"role_union"."pid"')
    .havingRaw(`${measure_sql} > 0`)
  if (include_year) {
    outer
      .select(physical_year_projection('nfl_games'))
      .groupByRaw(`"nfl_games"."${physical_year_column('nfl_games')}"`)
  }
  if (!is_aggregate) {
    outer.select(db.raw(`${period_key} AS period_key`)).groupByRaw(period_key)
  }
  // Same rule as the batched builder: nfl_games carries only what the fact
  // relation cannot express, and nfl_plays expresses all three components, so
  // it carries nothing. Every union arm above already scoped nfl_plays and the
  // outer join is on esbid, so the dropped predicates were implied by the
  // fact-side ones they duplicated.
  apply_scope_to_query({
    query: outer,
    table_name: 'nfl_games',
    query_context,
    column_params: params,
    has_season_year: false,
    has_season_type: !physical_has_seas_type(source_table),
    has_nfl_week_id: !physical_has_nfl_week_id(source_table)
  })
  // career_year / career_game: legacy with_func joined player_seasonlogs on
  // (pid, year, seas_type) and filtered between bounds. Mirror that here so
  // role-union numerators respect career_year params -- without this, the
  // per-game denominator (period-denominator/per-game.mjs) correctly restricts to
  // career_year games while the numerator sums all-time, inflating the rate.
  const career_year = params && params.career_year
  const career_game = params && params.career_game
  // The two params live on DIFFERENT tables and need their own joins:
  // career_year is a season-grain column on player_seasonlogs, career_game is a
  // game-grain column on player_gamelogs. Joining player_seasonlogs for both and
  // filtering `player_seasonlogs.career_game` raises 42703 -- that column has
  // never existed there. Matches add-player-stats-play-by-play-with-statement.
  if (career_year) {
    outer.innerJoin('player_seasonlogs', function () {
      this.on('player_seasonlogs.pid', '=', 'role_union.pid')
      this.andOn('player_seasonlogs.season_year', '=', 'nfl_games.season_year')
      this.andOn('player_seasonlogs.season_type', '=', 'nfl_games.season_type')
    })
    const arr = Array.isArray(career_year)
      ? career_year
      : [career_year, career_year]
    outer.whereBetween(
      'player_seasonlogs.career_year',
      normalize_career_year_range(arr)
    )
  }
  if (career_game) {
    outer.innerJoin('player_gamelogs', function () {
      this.on('player_gamelogs.pid', '=', 'role_union.pid')
      this.andOn('player_gamelogs.esbid', '=', 'role_union.esbid')
    })
    const arr = Array.isArray(career_game)
      ? career_game
      : [career_game, career_game]
    outer.whereBetween(
      'player_gamelogs.career_game',
      normalize_career_year_range(arr)
    )
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
  role_columns,
  apply_filters,
  measures,
  period,
  query_context,
  identity_id,
  params = {},
  force_year_grain = false
}) => {
  const is_team = identity_id.startsWith('team')
  const period_key = period_key_expr(period)
  const base_source = resolve_fact_source(measure_source)
  // For the `plays` source, params.team_unit selects which side of the play
  // the team grouping uses: 'def' groups by defender, otherwise offense
  // (possession_nfl_team). Mirrors the legacy
  // `add_team_stats_play_by_play_with_statement` semantics so team_unit='def'
  // team-stat columns aggregate per defender.
  const team_code_column =
    measure_source === 'plays' && params?.team_unit === 'def'
      ? 'defense_nfl_team'
      : base_source.team_code_column
  const source = { ...base_source, team_code_column }
  const source_table = source.table

  if (is_team && !source.team_code_column) {
    throw new Error(
      `measure_source '${measure_source}' does not support team identity`
    )
  }

  const is_aggregate = period === 'aggregate'

  if (source.subject_attribution === 'multi_role') {
    throw new Error(
      'build_batched_period_cte does not handle multi_role attribution; route via build_period_cte'
    )
  }

  // The batched path has no player_seasonlogs join, so career_year /
  // career_game predicates cannot be enforced here. Legacy with_func callers
  // strip these params before apply_filters; any future batched-path consumer
  // that relies on career-scoped filtering must be routed through
  // build_role_union_period_cte (which joins player_seasonlogs) or extend this
  // builder to mirror that join.
  if (params.career_year != null || params.career_game != null) {
    throw new Error(
      'build_batched_period_cte does not support career_year/career_game; route via build_role_union_period_cte or extend the batched path'
    )
  }

  // The subject-id expression and whether reaching it needs the `player` join
  // are both properties of the fact source, so the registry answers them. A
  // `single_role` source names no subject of its own and takes the column's
  // declared role columns, coalesced in their DECLARED order. Declarations are
  // deliberately NOT sorted: the COALESCE order decides which player a fact is
  // credited to, and over 2023+ `passer_pid` and `target_pid` are both non-null
  // and different on 60,547 plays. The table alias and the batch key hash the
  // same declared order so the two conventions cannot disagree.
  const { expression: pid_expr, requires_player_join: extra_player_join } =
    subject_id_expression({
      fact_source: source,
      role_columns
    })

  const sub = db(source_table)

  if (source.extra_join) source.extra_join(sub)

  // The cohort expansion is what makes the subject-id expression resolvable at
  // all for a cohort source -- `pid_expr` names the members alias this join
  // binds. It multiplies rows by group size, which is the whole cost of a share
  // and is documented on the registry entry.
  if (source.cohort_expansion) source.cohort_expansion.join(sub)

  const include_year =
    !is_aggregate || query_context.row_axes.includes('year') || force_year_grain
  sub.innerJoin('nfl_games', 'nfl_games.esbid', `${source_table}.esbid`)
  if (include_year) sub.select(physical_year_projection('nfl_games'))
  if (!is_aggregate) {
    sub.select(db.raw(`${period_key} AS period_key`))
  }

  if (extra_player_join) {
    sub.innerJoin(
      'player',
      'player.gsis_it_player_id',
      `${source_table}.gsis_it_player_id`
    )
  }

  if (is_team) {
    sub.select(`${source_table}.${source.team_code_column} as team_code`)
  } else {
    sub.select(db.raw(`${pid_expr} AS pid`))
  }

  // One aggregate(...) AS <alias> per measure. Single-measure callers pass one
  // entry with alias='measure_total' (legacy shape); batched callers pass
  // N entries with alias='m_<hash>' each. Identifiers in `alias` are
  // generated from md5 hashes and are safe to embed via db.raw. `aggregate`
  // selects the per-measure aggregate: 'count_distinct' emits COUNT(DISTINCT
  // expr) (for distinct-count measures like series/drive counts); anything
  // else (default 'sum') emits SUM(expr). A count_distinct and a sum measure
  // can co-locate in one CTE -- both are valid aggregates over the same scan.
  for (const {
    alias,
    measure_expr: m_expr,
    aggregate,
    combined_measure,
    accumulator_selects
  } of measures) {
    if (accumulator_selects) {
      // One column per accumulator, unaggregated by any combine. Asked for by
      // the consumer that recombines ONE GRAIN COARSER -- the multi-year
      // team-play wrap sums each accumulator across years and combines after,
      // because combining first and summing would sum per-year ratios.
      for (const fragment of accumulator_selects) sub.select(db.raw(fragment))
    } else if (combined_measure) {
      // The combine rendered over this scan's own GROUP BY, which is the period.
      // `value(period) = combine(accumulate(facts in period))` -- the same law
      // the season render applies over the whole scope.
      sub.select(db.raw(`${render_measure_sql(combined_measure)} AS ${alias}`))
    } else if (aggregate === 'count_distinct') {
      sub.select(db.raw(`COUNT(DISTINCT ${m_expr}) AS ${alias}`))
    } else {
      sub.select(db.raw(`SUM(${m_expr}) AS ${alias}`))
    }
  }
  sub.groupByRaw(
    is_team ? `${source_table}.${source.team_code_column}` : pid_expr
  )
  if (!is_aggregate) sub.groupByRaw(period_key)
  if (include_year) sub.groupByRaw('"nfl_games"."season_year"')

  if (measure_predicate) {
    sub.whereRaw(measure_predicate)
  }

  // The fact scan needs the scope on ITS OWN side to prune partitions -- the
  // apply_filters path emits a season type but no year, because it runs without
  // a query_context and so never reaches the scope-owned branch. See
  // apply_scope_to_fact_relation.
  apply_scope_to_fact_relation({
    query: sub,
    table_name: source_table,
    query_context,
    params
  })

  // nfl_games then carries only the components the fact table CANNOT express:
  // player_gamelogs has a season year and no season type, so a REG-only view
  // still has to gate the join. Emitting a component on both sides is not free
  // defense in depth -- the duplicate is what flipped the WOPR per-period CTE
  // onto a nested loop that reads 5.98M buffers against 179K, turning the
  // pruning win into a 0.7s LOSS. Measured on production 2026-08-21: scope on
  // both sides 6.3s, scope on the fact side alone 3.1s.
  //
  // Dropping the predicates does not widen the scan: every fact row joins
  // nfl_games on esbid, and the two agree on (year, season type, week) for all
  // 1,487,212 rows of nfl_plays, so the nfl_games predicate was implied by the
  // fact-side one it duplicates.
  apply_scope_to_query({
    query: sub,
    table_name: 'nfl_games',
    query_context,
    column_params: params,
    has_season_year: false,
    has_season_type: !physical_has_seas_type(source_table),
    has_nfl_week_id: !physical_has_nfl_week_id(source_table)
  })

  // The cohort members table is reached by a join the fact-side predicates
  // never touch, so it prunes only on a predicate of its own; without one the
  // expansion reads every player_gamelogs partition for a single-year view.
  if (source.cohort_expansion) {
    apply_scope_to_fact_relation({
      query: sub,
      table_name: source.cohort_expansion.table,
      alias: source.cohort_expansion.alias,
      query_context,
      params
    })
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
  const { row_grain_id, row_axes } = query_context
  if (row_grain_id !== 'player') return
  if (row_axes.includes('year') && has_bridge('player', 'player_year')) {
    ensure_split_bridge_joined({
      query_context,
      from: 'player',
      to: 'player_year'
    })
  }
  if (
    row_axes.includes('week') &&
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
  const source = resolve_fact_source(column_def.measure_source)
  // Batchable sources route into the measure-batch registry; the CTE is
  // materialized in a single `withMaterialized` call at flush time with one
  // `SUM(...) AS m_<hash>` column per registered measure. See measure-batch.mjs.
  if (
    is_batchable({ column_def }) &&
    source.subject_attribution !== 'multi_role'
  ) {
    const measure_alias = compute_measure_alias({
      column_def,
      params,
      identity_id
    })
    // A combined measure carries its declaration instead of an expression; the
    // builder renders the combine over the period group. Everything else --
    // batching, the group key, the summary -- is identical for the two shapes.
    const measure_expr = column_def.combined_measure
      ? null
      : column_def.measure_expr({
          table_name: source.table,
          params,
          identity_id
        })
    const common = {
      measure_source: column_def.measure_source,
      measure_predicate: column_def.measure_predicate
        ? column_def.measure_predicate({ params, identity_id })
        : null,
      role_columns: column_def.role_columns,
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
      combined_measure: column_def.combined_measure ?? null,
      aggregate: column_def.aggregate ?? 'sum',
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
  const game_conditional_expr = column_def.game_conditional_expr
    ? await column_def.game_conditional_expr({ params, identity_id })
    : null
  const sub = build_period_cte({
    measure_source: column_def.measure_source,
    measure_expr: null,
    game_conditional_expr,
    measure_predicate: column_def.measure_predicate
      ? column_def.measure_predicate({ params, identity_id })
      : null,
    role_attributions,
    role_columns: column_def.role_columns,
    apply_filters: column_def.apply_filters
      ? ({ query }) => column_def.apply_filters({ query, params, identity_id })
      : null,
    period,
    query_context,
    identity_id,
    params
  })
  query_context.players_query.withMaterialized(cte_name, sub)
  query_context.applied_output_ctes.add(cte_name)
}
