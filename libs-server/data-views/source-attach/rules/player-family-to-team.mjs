import { register } from '../source-attach-registry.mjs'

// (player|player_year|player_year_week, team, default). Used by attach-based
// sources (e.g., team-stats-from-plays player-cell variant) that join via the
// player_year_teams CTE without exposing a structured key_columns mapping.
// emit_predicate is unused because every consumer drives the join through
// source.attach; the rule's required_identity_bridges chain materializes the
// player_year_teams CTE the attach reads from query_context.

const no_emit = () => {
  throw new Error(
    'player-family-to-team rule is source.attach-only; emit_predicate must not be invoked'
  )
}

register({
  cell_identity: 'player',
  source_grain: 'team',
  mode: 'default',
  required_identity_bridges: [
    { from: 'player', to: 'player_year', mode: 'default' },
    { from: 'player_year', to: 'team_year', mode: 'default' }
  ],
  emit_predicate: no_emit
})

register({
  cell_identity: 'player_year',
  source_grain: 'team',
  mode: 'default',
  required_identity_bridges: [
    { from: 'player_year', to: 'team_year', mode: 'default' }
  ],
  emit_predicate: no_emit
})

register({
  cell_identity: 'player_year_week',
  source_grain: 'team',
  mode: 'default',
  required_identity_bridges: [
    { from: 'player_year', to: 'team_year', mode: 'default' }
  ],
  emit_predicate: no_emit
})
