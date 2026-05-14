import db from '#db'

const game_period_key =
  "CONCAT(nfl_games.year, '_', nfl_games.week, '_', nfl_games.esbid)"
const season_period_key = "CONCAT(nfl_games.year, '_', nfl_games.seas_type)"

const period_key_expr = (period) => {
  if (period === 'game') return game_period_key
  if (period === 'season') return season_period_key
  throw new Error(`build_period_cte does not handle period: ${period}`)
}

export const build_period_cte = ({
  measure_source,
  measure_expr,
  measure_predicate,
  pid_columns,
  period,
  query_context,
  identity_id
}) => {
  const is_team = identity_id.startsWith('team')
  const period_key = period_key_expr(period)

  const source_table =
    measure_source === 'plays' ? 'nfl_plays' : 'player_gamelogs'
  const team_column = source_table === 'nfl_plays' ? 'pos_team' : 'tm'

  // `nfl_plays` has no `pid` column; the per-play player association is
  // split across role columns (`trg_pid`, `bc_pid`, `psr_pid`). For
  // plays-source player measures the column-definition declares which
  // role(s) participate; we COALESCE them into a single grouping key.
  // For gamelogs-source measures `pid` is real and `pid_columns` defaults
  // to `['pid']`.
  const pid_expr = (() => {
    if (source_table !== 'nfl_plays') return `${source_table}.pid`
    if (!pid_columns || !pid_columns.length) return `${source_table}.pid`
    if (pid_columns.length === 1) return `${source_table}.${pid_columns[0]}`
    return `COALESCE(${pid_columns
      .map((col) => `${source_table}.${col}`)
      .join(', ')})`
  })()

  const sub = db(source_table)
    .innerJoin('nfl_games', 'nfl_games.esbid', `${source_table}.esbid`)
    .select(db.raw(`${period_key} AS period_key`))
    .select('nfl_games.year')

  if (is_team) {
    sub.select(`${source_table}.${team_column} as team_code`)
    sub.groupBy(`${source_table}.${team_column}`)
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

  return sub
}

// Shared `add_cte` body for output-aggregator plugins. Idempotent on
// `applied_output_ctes`; aggregator-count and aggregator-rate differ only
// in `join_cte` / `emit_outer_select`, so the CTE construction and
// materialization are factored here.
export const add_period_cte = ({
  query_context,
  column_def,
  params,
  cte_name,
  identity_id,
  period
}) => {
  if (query_context.applied_output_ctes.has(cte_name)) return
  const sub = build_period_cte({
    measure_source: column_def.measure_source,
    measure_expr: column_def.measure_expr({
      table_name:
        column_def.measure_source === 'plays' ? 'nfl_plays' : 'player_gamelogs',
      params,
      identity_id
    }),
    measure_predicate: column_def.measure_predicate
      ? column_def.measure_predicate({ params, identity_id })
      : null,
    pid_columns: column_def.pid_columns,
    period,
    query_context,
    identity_id
  })
  query_context.players_query.withMaterialized(cte_name, sub)
  query_context.applied_output_ctes.add(cte_name)
}
