// Resolves the SQL column expression that a team-grained CTE's nfl_team
// column should be equated to, given the active query context and column
// params. Single source of truth for the projection of team-grained stats
// onto player or team subjects.
//
// Precedence:
//   1. matchup_opponent_type='current_week_opponent_total' -> opponent CTE
//   2. matchup_opponent_type='next_week_opponent_total'    -> opponent CTE
//   3. team_reference set (team-subject query)             -> team_reference
//   4. player_year_teams CTE registered (year split)       -> per-season team
//   5. default                                             -> player.current_nfl_team
//
// Consumed by:
//   - apply_team_stats_join (JOIN path in team-stats-from-plays column-defs)
//   - get_select_string year_offset_range branch (correlated-subquery path
//     in libs-server/data-views/select-string.mjs)
export const resolve_team_join_target = ({ query_context, params = {} }) => {
  const raw = Array.isArray(params.matchup_opponent_type)
    ? params.matchup_opponent_type[0] &&
      typeof params.matchup_opponent_type[0] === 'object'
      ? null
      : params.matchup_opponent_type[0]
    : params.matchup_opponent_type

  if (raw === 'current_week_opponent_total') {
    return 'current_week_opponents.opponent'
  }
  if (raw === 'next_week_opponent_total') {
    return 'next_week_opponents.opponent'
  }

  const dv = query_context.data_view_options
  const team_reference = dv?.team_reference ?? query_context.team_reference
  if (team_reference) return team_reference

  const { player_year_teams_cte_name } = query_context
  if (player_year_teams_cte_name) {
    return `${player_year_teams_cte_name}.team`
  }

  return 'player.current_nfl_team'
}
