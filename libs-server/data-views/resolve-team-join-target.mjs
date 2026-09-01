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
//   5. player_week_teams CTE registered (week split)       -> per-week team
//   6. player_year_teams CTE registered (year split)       -> per-season team
//   7. default                                             -> player.current_nfl_team
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

  // Week grain before year grain: when the week bridge is registered the cell
  // knows which week it is, so the season-long majority approximation has
  // nothing left to offer. The two are never both registered for one column --
  // the source-attach rule requires exactly one, chosen by cell identity -- but
  // a sibling column in the same view can register the other, so the order here
  // decides who wins and the finer grain must.
  //
  // nfl_team_most_recent, not nfl_team. This branch serves TEAM stats, whose
  // cell is a fact about the team over a span; the player's own participation is
  // deliberately not the criterion, which is what the player_team_* family is
  // for. The exact column would render nothing for a bye or an injured-reserve
  // week and quietly shrink a season total to the weeks he happened to dress.
  // See the bridge module for the two columns and why they differ.
  const { player_week_teams_cte_name } = query_context
  if (player_week_teams_cte_name) {
    return `${player_week_teams_cte_name}.nfl_team_most_recent`
  }

  const { player_year_teams_cte_name } = query_context
  if (player_year_teams_cte_name) {
    return `${player_year_teams_cte_name}.team`
  }

  return 'player.current_nfl_team'
}

// Single source of truth for the team_attribution param: always returns one of
// the closed set ('historical' | 'current'), defaulting to 'historical'.
// Array-unwrapped at read time (params arrive as single values or 1-element
// arrays). Anything other than 'current' (unset, unknown string, malformed
// array) normalises to 'historical' -- no validation throw, matching the rest
// of the param surface, but the return value is guaranteed to be one of the two
// canonical tokens so callers may safely compare against either. Kept here --
// the canonical "where does a team stat attach" module -- and self-contained
// (no param-utils import) because param-utils imports THIS module, so the
// reverse dependency would be circular.
export const get_team_attribution = (params = {}) => {
  const raw = Array.isArray(params.team_attribution)
    ? params.team_attribution[0]
    : params.team_attribution
  return raw === 'current' ? 'current' : 'historical'
}
