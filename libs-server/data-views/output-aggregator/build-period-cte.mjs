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
  period,
  query_context,
  identity_id
}) => {
  const is_team = identity_id.startsWith('team')
  const period_key = period_key_expr(period)

  const source_table =
    measure_source === 'plays' ? 'nfl_plays' : 'player_gamelogs'
  const team_column = source_table === 'nfl_plays' ? 'pos_team' : 'tm'

  const sub = db(source_table)
    .innerJoin('nfl_games', 'nfl_games.esbid', `${source_table}.esbid`)
    .select(db.raw(`${period_key} AS period_key`))
    .select('nfl_games.year')

  if (is_team) {
    sub.select(`${source_table}.${team_column} as team_code`)
    sub.groupBy(`${source_table}.${team_column}`)
  } else {
    sub.select(`${source_table}.pid`)
    sub.groupBy(`${source_table}.pid`)
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
