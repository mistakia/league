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

// A player_year_week CELL asks its question one week at a time, so it takes the
// WEEK bridge rather than the year one. The year bridge answers "which team did
// he play the most games for this season" and applies that one answer to all 18
// weeks, which is wrong for every week a traded player spent on the other team
// -- and wrong with a plausible NUMBER rather than an empty cell, because the
// majority team usually played that week too. Measured on the REG corpus:
// 1,012 / 888 / 540 player-weeks in 2023 / 2024 / 2025 are attributed to a team
// the player was not on that week.
//
// Nothing here needs a row_axes check. cell_identity IS the row grain, so
// reaching this registration already means a week axis is active; the year-grain
// registration above keeps the year bridge and is untouched.
const team_year_week_bridge = {
  from: 'player_year_week',
  to: 'team_year_week',
  mode: 'default'
}

const required_team_year_week_bridge = (params) =>
  get_team_attribution(params) === 'current' ? [] : [team_year_week_bridge]

register({
  cell_identity: 'player_year_week',
  source_grain: 'team',
  mode: 'default',
  required_identity_bridges: required_team_year_week_bridge,
  emit_predicate: no_emit
})
