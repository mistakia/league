import { nfl_week_identifier } from '#libs-shared'

export default function apply_nfl_games_offset_week_join({
  db,
  query,
  offset,
  alias,
  team_column = 'player.current_nfl_team'
}) {
  const params = nfl_week_identifier.nfl_week_offset_params({ offset })
  if (!params) return query

  const { year, seas_type, week } = params
  const table_expr = `nfl_games as ${alias}`

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
