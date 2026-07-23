import { nfl_week_identifier } from '#libs-shared'

export default function apply_practice_current_week_join({
  db,
  query,
  alias = 'practice',
  pid_column = 'player.pid'
}) {
  const { year, seas_type, week } =
    nfl_week_identifier.current_nfl_week_params()
  const table_expr = alias === 'practice' ? 'practice' : `practice as ${alias}`

  query.leftJoin(table_expr, function () {
    this.on(`${alias}.pid`, '=', pid_column)
      .andOn(`${alias}.season_year`, '=', db.raw('?::int', [year]))
      .andOn(`${alias}.season_type`, '=', db.raw('?::text', [seas_type]))
      .andOn(`${alias}.week`, '=', db.raw('?::int', [week]))
  })

  return query
}
