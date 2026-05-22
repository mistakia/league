// Wrap-mode detection for `team_*_from_plays` columns (team-variant) on
// player-subject views.
//
// Why this exists:
// The team-variant (`team_pass_yards_from_plays`, `team_ep_added_from_plays`,
// etc., NOT the `_player_team_*` variant) joins the `_team_stats` CTE on
// `nfl_team = player_year_teams.team`. With multiple years selected and no
// `year` split, the base CTE collapses years and `player_year_teams.year` is
// pinned to `max(year_range)`, so a player who switched teams gets a single
// team's multi-year totals attributed -- and players with no row for the
// latest year return NULL even when they accumulated stats earlier.
//
// What wrap mode does:
//   1. Promotes the base `nfl_plays` CTE to (nfl_team, year) grain so each
//      team-year cell is addressable.
//   2. Replaces the `_team_stats` aggregation: instead of grouping by
//      `nfl_team` alone, INNER JOIN `player_year_teams` on (team, year) and
//      GROUP BY pid -- so each year's team-stat lands on the team the player
//      actually played for that year, then sums back to pid.
//   3. The outer join in `apply_team_stats_join` becomes a 1:1 pid join.
//
// Trigger predicate mirrors `per-team-play-wrap.requires_wrap`:
//   - Player subject (team subject joins team_stats directly on team).
//   - 2+ distinct effective years.
//   - No `year` split (the standard year-split row grain already correctly
//     attributes per-year).
//   - No matchup_opponent_type (point-in-time opponent joins).
//   - `force_player_active` is false (the `_player_team_stats` variant
//     attributes inside its own CTE via player_gamelogs).

import { compute_effective_scope } from '#libs-server/data-views/apply-scope-to-query.mjs'
import { decompose_nfl_weeks } from '#libs-shared/nfl-week-identifier.mjs'

const resolve_effective_years = ({ query_context, params }) => {
  const effective_scope = compute_effective_scope({
    query_context,
    column_params: params
  })
  if (effective_scope.length) {
    const { years } = decompose_nfl_weeks({ nfl_weeks: effective_scope })
    return years
  }
  return Array.isArray(query_context.year_range) ? query_context.year_range : []
}

export const requires_team_stats_wrap = ({
  query_context,
  params,
  force_player_active
}) => {
  if (force_player_active) return false
  const identity_id = query_context.identity_id
  if (!identity_id || !identity_id.startsWith('player')) return false
  if (query_context.splits.includes('year')) return false

  const matchup = Array.isArray(params?.matchup_opponent_type)
    ? params.matchup_opponent_type[0] &&
      typeof params.matchup_opponent_type[0] === 'object'
      ? null
      : params.matchup_opponent_type[0]
    : params?.matchup_opponent_type
  if (matchup) return false

  const years = resolve_effective_years({ query_context, params })
  const distinct_years = new Set(years.map((y) => parseInt(y, 10)))
  if (distinct_years.size < 2) return false

  return true
}
