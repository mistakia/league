// Resolves the SQL column expression that a team-grained CTE's nfl_team
// column should be equated to, given the active query context and column
// params. Single source of truth for the projection of team-grained stats
// onto player or team subjects.
//
// Precedence:
//   1. matchup_opponent_type='current_week_opponent_total' -> opponent CTE
//   2. matchup_opponent_type='next_week_opponent_total'    -> opponent CTE
//   3. team_reference set (team-subject query)             -> team_reference
//   4. team_attribution='current'                          -> player.current_nfl_team
//   5. player_year_teams CTE registered (year split)       -> per-season team
//   6. default                                             -> player.current_nfl_team
//
// The team_attribution='current' branch is placed BEFORE the player_year_teams
// CTE shortcut so a 'current' column is not dragged onto player_year_teams.team
// merely because a sibling 'historical' column registered that bridge.
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

  if (get_team_attribution(params) === 'current')
    return 'player.current_nfl_team'

  const { player_year_teams_cte_name } = query_context
  if (player_year_teams_cte_name) {
    return `${player_year_teams_cte_name}.team`
  }

  return 'player.current_nfl_team'
}

// Single source of truth for the team_attribution param: a closed set
// ('historical' | 'current') defaulting to 'historical'. Array-unwrapped at
// read time (params arrive as single values or 1-element arrays). Kept here --
// the canonical "where does a team stat attach" module -- and self-contained
// (no param-utils import) because param-utils imports THIS module, so the
// reverse dependency would be circular. Unknown values normalise to historical
// by falling through every `=== 'current'` check (no validation throw, matching
// the rest of the param surface).
export const get_team_attribution = (params = {}) => {
  const raw = Array.isArray(params.team_attribution)
    ? params.team_attribution[0]
    : params.team_attribution
  return raw ?? 'historical'
}
