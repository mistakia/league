import { register } from '../source-attach-registry.mjs'

// (player|player_year|player_year_week, team_year, matchup_opponent_*). The
// current_week_opponents / next_week_opponents CTEs are attached upstream by
// get-data-view-results.mjs (which also INNER JOINs them onto
// player.current_nfl_team), so no identity bridges are required here. The
// rule emits only the team-key predicate against the appropriate opponents
// CTE; year and any per-source discriminators flow through source.extra_predicates.

const make_emit =
  (opponents_cte) =>
  ({ source, table_alias, builder }) => {
    const ref = table_alias || source.table
    const key_columns = source.key_columns || {}
    if (!key_columns.team) {
      throw new Error(
        `matchup-opponent rule requires source.key_columns.team (source.table=${source.table})`
      )
    }
    builder.on(`${ref}.${key_columns.team}`, '=', `${opponents_cte}.opponent`)
  }

for (const cell_identity of ['player', 'player_year', 'player_year_week']) {
  register({
    cell_identity,
    source_grain: 'team_year',
    mode: 'matchup_opponent_current_week',
    required_identity_bridges: [],
    emit_predicate: make_emit('current_week_opponents')
  })
  register({
    cell_identity,
    source_grain: 'team_year',
    mode: 'matchup_opponent_next_week',
    required_identity_bridges: [],
    emit_predicate: make_emit('next_week_opponents')
  })
}
