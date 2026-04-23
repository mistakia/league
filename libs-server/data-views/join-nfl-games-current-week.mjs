import { nfl_week_identifier } from '#libs-shared'

export default function apply_nfl_games_current_week_join({
  db,
  query,
  alias = 'nfl_games',
  team_column = 'player.current_nfl_team'
}) {
  const { year, seas_type, week } =
    nfl_week_identifier.current_nfl_week_params()
  const table_expr =
    alias === 'nfl_games' ? 'nfl_games' : `nfl_games as ${alias}`

  query.leftJoin(table_expr, function () {
    this.on(function () {
      this.on(`${alias}.h`, '=', team_column).orOn(
        `${alias}.v`,
        '=',
        team_column
      )
    })
      .andOn(`${alias}.year`, '=', db.raw('?::int', [year]))
      .andOn(`${alias}.seas_type`, '=', db.raw('?::text', [seas_type]))
      .andOn(`${alias}.week`, '=', db.raw('?::int', [week]))
  })

  return query
}
