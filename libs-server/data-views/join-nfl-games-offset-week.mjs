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

  const { year: season_year, seas_type: season_type, week } = params
  const table_expr = `nfl_games as ${alias}`

  query.leftJoin(table_expr, function () {
    this.on(function () {
      this.on(`${alias}.home_nfl_team`, '=', team_column).orOn(
        `${alias}.away_nfl_team`,
        '=',
        team_column
      )
    })
      .andOn(`${alias}.season_year`, '=', db.raw('?::int', [season_year]))
      .andOn(`${alias}.season_type`, '=', db.raw('?::text', [season_type]))
      .andOn(`${alias}.week`, '=', db.raw('?::int', [week]))
  })

  return query
}
