import db from '#db'

const game_period_key =
  "CONCAT(nfl_games.year, '_', nfl_games.week, '_', nfl_games.esbid)"
const season_period_key = "CONCAT(nfl_games.year, '_', nfl_games.seas_type)"

const period_key_expr = (period) => {
  if (period === 'game') return game_period_key
  if (period === 'season') return season_period_key
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

export const build_period_cte = ({
  measure_source,
  measure_expr,
  measure_predicate,
  role_attributions,
  pid_columns,
  apply_filters,
  period,
  query_context,
  identity_id
}) => {
  const is_team = identity_id.startsWith('team')
  const period_key = period_key_expr(period)
  const source = resolve_source(measure_source)
  const source_table = source.table

  if (is_team && !source.team_col) {
    throw new Error(
      `measure_source '${measure_source}' does not support team identity`
    )
  }

  if (source.pid_via === 'role_union') {
    if (!role_attributions || !role_attributions.length) {
      throw new Error(
        `measure_source '${measure_source}' requires role_attributions`
      )
    }
    // SECURITY: `pid_column` must be a hardcoded identifier and
    // `measure_expr` must contain only column refs / literals -- both are
    // emitted via db.raw/whereRaw without bindings. Any param-derived value
    // routed through them is a SQL-injection surface; column-defs must use
    // Knex bindings for runtime values. Same convention as `measure_predicate`.
    const union_subs = role_attributions.map(
      ({ pid_column, measure_expr: role_measure_expr }) => {
        const sub = db(source_table)
          .select(db.raw(`${source_table}.${pid_column} AS pid`))
          .select(`${source_table}.esbid`)
          .select(db.raw(`${role_measure_expr} AS pts`))
          .whereRaw(`${source_table}.${pid_column} IS NOT NULL`)
        if (measure_predicate) sub.whereRaw(measure_predicate)
        // Push year filter into each inner sub so the partitioned
        // `nfl_plays_year_<N>` partitions prune at scan time, instead of
        // discarding rows after the outer `nfl_games` join.
        if (query_context.year_range && query_context.year_range.length) {
          sub.whereIn(`${source_table}.year`, query_context.year_range)
        }
        // Column-supplied filter hook: lets columns with complex param-
        // driven filter shapes (e.g. fantasy points reusing
        // apply_play_by_play_column_params_to_query) apply Knex builder
        // operations directly. Runs once per inner role sub so partition
        // pruning fires before the UNION.
        if (apply_filters) apply_filters({ query: sub })
        return sub
      }
    )
    const inner_union = union_subs
      .slice(1)
      .reduce((acc, sub) => acc.unionAll(sub), union_subs[0])
    const outer = db
      .from(inner_union.as('role_union'))
      .innerJoin('nfl_games', 'nfl_games.esbid', 'role_union.esbid')
      .select(db.raw(`${period_key} AS period_key`))
      .select('nfl_games.year')
      .select('role_union.pid AS pid')
      .select(db.raw('SUM(role_union.pts) AS measure_total'))
      .groupBy('role_union.pid', db.raw(period_key), 'nfl_games.year')
      .havingRaw('SUM(role_union.pts) > 0')
    if (query_context.year_range && query_context.year_range.length) {
      outer.whereIn('nfl_games.year', query_context.year_range)
    }
    return outer
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

  sub
    .innerJoin('nfl_games', 'nfl_games.esbid', `${source_table}.esbid`)
    .select(db.raw(`${period_key} AS period_key`))
    .select('nfl_games.year')

  if (extra_player_join) {
    sub.innerJoin(
      'player',
      'player.gsis_it_id',
      `${source_table}.gsis_it_id`
    )
  }

  if (is_team) {
    sub.select(`${source_table}.${source.team_col} as team_code`)
    sub.groupBy(`${source_table}.${source.team_col}`)
  } else {
    sub.select(db.raw(`${pid_expr} AS pid`))
    sub.groupBy(db.raw(pid_expr))
  }

  sub.select(db.raw(`SUM(${measure_expr}) AS measure_total`))
  sub.groupBy(db.raw(period_key), 'nfl_games.year')

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
export const add_period_cte = async ({
  query_context,
  column_def,
  params,
  cte_name,
  identity_id,
  period
}) => {
  if (query_context.applied_output_ctes.has(cte_name)) return
  const source = resolve_source(column_def.measure_source)
  const role_attributions =
    source.pid_via === 'role_union'
      ? await column_def.role_attributions({ params, identity_id })
      : null
  const sub = build_period_cte({
    measure_source: column_def.measure_source,
    measure_expr:
      source.pid_via === 'role_union'
        ? null
        : column_def.measure_expr({
            table_name: source.table,
            params,
            identity_id
          }),
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
    identity_id
  })
  query_context.players_query.withMaterialized(cte_name, sub)
  query_context.applied_output_ctes.add(cte_name)
}
