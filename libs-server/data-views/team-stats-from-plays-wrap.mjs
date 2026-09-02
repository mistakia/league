// Wrap-mode detection for `team_*_from_plays` columns (team-variant) on
// player-subject views.
//
// Without this, the team-variant column joins `_team_stats` on the team a
// player is resolved to for the WHOLE span -- historically the
// `player_year_teams` majority rule, which picks the team he played the most
// games for and then attributes that team's entire span to him. Wrap mode
// re-shapes the `_team_stats` CTE so each WEEK's team-stat lands on the team
// the player was attached to in that week, and then sums to the subject.
//
// The invariant it exists to hold: a season cell equals the sum of the cells
// the same view renders when split by week. Those two disagreed under the
// majority rule -- a mid-season trade moved games between teams and the
// season cell still showed one team's full season -- and a column whose total
// contradicts its own breakdown is not a defensible thing to render.
//
// Weeks before a player's first appearance in a season contribute nothing,
// because `player_week_teams` carries a team FORWARD only: he was on no team
// then, so there is no team-week to attribute. Backfilling his first team to
// week 1 was considered and rejected -- a player signed in week 12 would carry
// eleven weeks of a team he never played for, which is the error this whole
// migration exists to remove.

import {
  resolve_effective_years,
  extract_matchup_opponent_type
} from '#libs-server/data-views/wrap-predicates.mjs'
import { get_team_attribution } from '#libs-server/data-views/resolve-team-join-target.mjs'

export const requires_team_stats_wrap = ({
  query_context,
  params,
  force_player_active
}) => {
  // `_player_team_stats` (the force_player_active variant) already keys on
  // pid via an internal player_gamelogs join -- no wrap needed.
  if (force_player_active) return false

  // 'current' attribution attaches all volume to player.current_nfl_team
  // regardless of year; the wrap's per-(pid, year) team reattribution is both
  // wrong and wasteful for it. Skip -- the plain team-grain join then
  // correlates on current_nfl_team via resolve_team_join_target. Mirrors the
  // rate-type wrap gate in period-denominator/per-team-play-wrap.mjs.
  if (get_team_attribution(params) === 'current') return false

  const identity_id = query_context.identity_id
  if (!identity_id || !identity_id.startsWith('player')) return false
  // A week split already renders one cell per week, and the week-grain join
  // through `player_week_teams` attributes each of those cells directly. The
  // wrap is the SEASON-grain form of that same attribution, so it has nothing
  // to add here and would fan its per-subject total across every week row.
  if (query_context.row_axes.includes('week')) return false

  if (extract_matchup_opponent_type(params)) return false

  // A year split is still season grain -- one cell per (subject, year) -- so
  // the wrap fires and keys on (pid, year). Single-year no-split fires too:
  // the majority rule is wrong inside ONE season, which is where a trade
  // happens, so a year count is not what decides this.
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
