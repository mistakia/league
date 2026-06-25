// Wrap-mode detection for `team_*_from_plays` columns (team-variant) on
// player-subject views.
//
// Without this, the team-variant column joins `_team_stats` on
// `nfl_team = player_year_teams.team` with the player_year_teams CTE pinned
// to `max(year_range)`. A player who switched teams gets a single team's
// multi-year totals attributed; a player with no row for max(year_range)
// returns NULL. Wrap mode re-shapes the `_team_stats` CTE so each year's
// team-stat lands on the team the player played for that year and then
// sums to pid.

import {
  resolve_effective_years,
  extract_matchup_opponent_type
} from '#libs-server/data-views/wrap-predicates.mjs'

export const requires_team_stats_wrap = ({
  query_context,
  params,
  force_player_active
}) => {
  // `_player_team_stats` (the force_player_active variant) already keys on
  // pid via an internal player_gamelogs join -- no wrap needed.
  if (force_player_active) return false

  const identity_id = query_context.identity_id
  if (!identity_id || !identity_id.startsWith('player')) return false
  if (query_context.row_axes.includes('year')) return false
  // The wrap CTE collapses to (pid)-grain (no week); a week split would
  // fan that single value across every per-week outer row. The standard
  // (with-year-split-style) shape is required for week-split views.
  if (query_context.row_axes.includes('week')) return false

  if (extract_matchup_opponent_type(params)) return false

  const years = resolve_effective_years({ query_context, params })
  const distinct_years = new Set(years.map((y) => parseInt(y, 10)))
  if (distinct_years.size < 2) return false

  return true
}

// Cache the decision and resolved years on query_context so the dispatch
// loop (apply_team_stats_join) and the deferred with_func don't re-run
// compute_effective_scope per column.
export const get_team_stats_wrap_decision = ({
  query_context,
  params,
  force_player_active
}) => {
  if (!query_context.team_stats_wrap_decisions) {
    query_context.team_stats_wrap_decisions = new Map()
  }
  const key = `${force_player_active ? 'pa' : 'tm'}:${JSON.stringify(params || {})}`
  const cached = query_context.team_stats_wrap_decisions.get(key)
  if (cached) return cached

  const wrap_mode = requires_team_stats_wrap({
    query_context,
    params,
    force_player_active
  })
  const years = wrap_mode
    ? resolve_effective_years({ query_context, params })
    : null
  const decision = { wrap_mode, years }
  query_context.team_stats_wrap_decisions.set(key, decision)
  return decision
}
