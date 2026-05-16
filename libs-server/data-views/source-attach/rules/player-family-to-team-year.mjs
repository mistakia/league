import { register } from '../source-attach-registry.mjs'

// (player|player_year|player_year_week, team_year, default). The
// player_year_teams CTE (materialized by the player_year_to_team_year
// identity bridge) carries the canonical historical team-per-year mapping;
// the source row joins onto that CTE's team + year so historical-team-mode
// is a structural property of this rule rather than a runtime conditional.

const PYT = 'player_year_teams'

const emit = ({ source, table_alias, builder }) => {
  const ref = table_alias || source.table
  const key_columns = source.key_columns || {}
  if (!key_columns.team) {
    throw new Error(
      `player-family-to-team-year requires source.key_columns.team (source.table=${source.table})`
    )
  }
  builder.on(`${ref}.${key_columns.team}`, '=', `${PYT}.team`)
  if (key_columns.year) {
    builder.andOn(`${ref}.${key_columns.year}`, '=', `${PYT}.year`)
  }
}

register({
  cell_identity: 'player',
  source_grain: 'team_year',
  mode: 'default',
  required_identity_bridges: [
    { from: 'player_year', to: 'team_year', mode: 'default' }
  ],
  emit_predicate: emit
})

register({
  cell_identity: 'player_year',
  source_grain: 'team_year',
  mode: 'default',
  required_identity_bridges: [
    { from: 'player_year', to: 'team_year', mode: 'default' }
  ],
  emit_predicate: emit
})

register({
  cell_identity: 'player_year_week',
  source_grain: 'team_year',
  mode: 'default',
  required_identity_bridges: [
    { from: 'player_year', to: 'team_year', mode: 'default' }
  ],
  emit_predicate: emit
})
