import { register } from '../source-attach-registry.mjs'

// Cross-grain pairings on the team side. Direct team-key equality (no
// player_year_teams orphan). Bridges are chained only when the cell row
// must be widened (year/week extension) to expose the matching reference.

const emit_team_year_predicate = ({
  query_context,
  source,
  table_alias,
  builder,
  include_year,
  include_week
}) => {
  const ref = table_alias || source.table
  const { team_reference, year_reference, week_reference, db } = query_context

  builder.on(`${ref}.${source.key_columns.team}`, '=', team_reference)
  if (include_year && source.key_columns.year && year_reference) {
    builder.andOn(`${ref}.${source.key_columns.year}`, '=', year_reference)
  }
  if (include_week && source.key_columns.week && week_reference) {
    const week_col = `${ref}.${source.key_columns.week}`
    if (source.week_type === 'string') {
      builder.andOn(
        db.raw(`${week_col} = CAST(${week_reference} AS VARCHAR)`)
      )
    } else {
      builder.andOn(week_col, '=', week_reference)
    }
  }
}

// (team, team_year): need team_to_team_year bridge so year_reference is
// available (team identity has no year column).
register({
  cell_identity: 'team',
  source_grain: 'team_year',
  mode: 'default',
  required_identity_bridges: [
    { from: 'team', to: 'team_year', mode: 'default' }
  ],
  emit_predicate: (ctx) =>
    emit_team_year_predicate({ ...ctx, include_year: true })
})

// (team_year_week, team_year): cell already has year; drop week predicate.
register({
  cell_identity: 'team_year_week',
  source_grain: 'team_year',
  mode: 'default',
  required_identity_bridges: [],
  emit_predicate: (ctx) =>
    emit_team_year_predicate({ ...ctx, include_year: true })
})

// (team_year, team_year_week): cell has year; need team_year_to_team_year_week
// bridge to expose week_reference.
register({
  cell_identity: 'team_year',
  source_grain: 'team_year_week',
  mode: 'default',
  required_identity_bridges: [
    { from: 'team_year', to: 'team_year_week', mode: 'default' }
  ],
  emit_predicate: (ctx) =>
    emit_team_year_predicate({ ...ctx, include_year: true, include_week: true })
})

// (team, team_year_week): need both team_to_team_year and team_year_to_team_year_week.
register({
  cell_identity: 'team',
  source_grain: 'team_year_week',
  mode: 'default',
  required_identity_bridges: [
    { from: 'team', to: 'team_year', mode: 'default' },
    { from: 'team_year', to: 'team_year_week', mode: 'default' }
  ],
  emit_predicate: (ctx) =>
    emit_team_year_predicate({ ...ctx, include_year: true, include_week: true })
})
