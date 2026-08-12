import { register } from '../source-attach-registry.mjs'
import { get_team_attribution } from '../../resolve-team-join-target.mjs'

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

// team_attribution='current' attaches the source row to player.current_nfl_team
// (resolve_team_join_target returns it without reading the bridge), so the
// player_year_teams CTE is dead work -- a player_gamelogs scan plus an unused
// LEFT JOIN. Mirror the rate-type gate: apply the player_year->team_year bridge
// only for historical (default) attribution. The player->player_year bridge
// stays: the attach's year predicates and the row scope read player_years.
const team_year_bridge = {
  from: 'player_year',
  to: 'team_year',
  mode: 'default'
}

// required_identity_bridges is param-aware so the dispatcher can skip the
// historical bridge for a 'current'-attributed column.
const required_team_year_bridge = (params) =>
  get_team_attribution(params) === 'current' ? [] : [team_year_bridge]

register({
  cell_identity: 'player',
  source_grain: 'team',
  mode: 'default',
  required_identity_bridges: (params) => [
    { from: 'player', to: 'player_year', mode: 'default' },
    ...required_team_year_bridge(params)
  ],
  emit_predicate: no_emit
})

register({
  cell_identity: 'player_year',
  source_grain: 'team',
  mode: 'default',
  required_identity_bridges: required_team_year_bridge,
  emit_predicate: no_emit
})

register({
  cell_identity: 'player_year_week',
  source_grain: 'team',
  mode: 'default',
  required_identity_bridges: required_team_year_bridge,
  emit_predicate: no_emit
})
