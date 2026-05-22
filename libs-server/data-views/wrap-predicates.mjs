// Shared helpers for the multi-year-no-split wrap predicates used by
// `per-team-play-wrap.mjs` (rate-type denominator wrap) and
// `team-stats-from-plays-wrap.mjs` (team-stat column wrap). Both detect the
// same scope shape -- multiple years selected without a `year` split on a
// player subject -- so the matchup-param extraction and effective-year
// resolution live in one place.

import { compute_effective_scope } from '#libs-server/data-views/apply-scope-to-query.mjs'
import { decompose_nfl_weeks } from '#libs-shared/nfl-week-identifier.mjs'

export const resolve_effective_years = ({ query_context, params }) => {
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

export const extract_matchup_opponent_type = (params) => {
  const raw = Array.isArray(params?.matchup_opponent_type)
    ? params.matchup_opponent_type[0]
    : params?.matchup_opponent_type
  if (raw && typeof raw === 'object') return null
  return raw || null
}
