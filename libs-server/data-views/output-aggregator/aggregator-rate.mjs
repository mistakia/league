import crypto from 'crypto'

import { add_period_cte } from './build-period-cte.mjs'
import { consumed_params_signature } from './consumed-params-signature.mjs'

export const consumes_params = [
  'year',
  'nfl_week_id',
  'seas_type',
  'matchup_opponent_type'
]

export const get_cte_name = ({ column_def, params, identity_id, period }) => {
  const effective = column_def.consumes_params_extra
    ? [...consumes_params, ...column_def.consumes_params_extra]
    : consumes_params
  const key = JSON.stringify({
    column_id: column_def.column_id,
    measure_source: column_def.measure_source,
    identity_id,
    period,
    params: consumed_params_signature({ params, consumes_params: effective })
  })
  const hash = crypto.createHash('md5').update(key).digest('hex').slice(0, 12)
  return `rate_${period}_${hash}`
}

export const add_cte = add_period_cte

// Derive the team-side join target for a team-keyed CTE. Mirrors the legacy
// `join_team_per_game_cte` logic so player-subject views can consume team-
// stat columns and respect matchup_opponent_type the same way they did
// before the dispatcher rewrite.
//
// - subject 'team': use the team identity's team_column (from query_context).
// - subject 'player' viewing a team-keyed column:
//   - matchup_opponent_type=current_week_opponent_total -> current_week_opponents.opponent
//   - matchup_opponent_type=next_week_opponent_total -> next_week_opponents.opponent
//   - default -> player.current_nfl_team
const resolve_team_join_target = ({ query_context, params }) => {
  if (query_context.subject_id === 'team') return query_context.team_reference
  const raw = params?.matchup_opponent_type
  const matchup = Array.isArray(raw)
    ? raw[0] && typeof raw[0] === 'object'
      ? null
      : raw[0]
    : raw
  if (matchup === 'current_week_opponent_total')
    return 'current_week_opponents.opponent'
  if (matchup === 'next_week_opponent_total')
    return 'next_week_opponents.opponent'
  return 'player.current_nfl_team'
}

export const join_cte = ({
  query_context,
  cte_name,
  identity_id,
  params = {}
}) => {
  const { players_query, pid_reference, year_reference, splits } = query_context
  const is_team = identity_id.startsWith('team')
  const team_target = is_team
    ? resolve_team_join_target({ query_context, params })
    : null
  players_query.leftJoin(cte_name, function () {
    if (is_team) {
      this.on(`${cte_name}.team_code`, '=', team_target)
    } else {
      this.on(`${cte_name}.pid`, '=', pid_reference)
    }
    if (splits.includes('year') && year_reference) {
      this.andOn(`${cte_name}.year`, '=', year_reference)
    }
  })
}

export const emit_outer_select = ({ column_def, cte_name, column_index }) => {
  if (!column_def.column_name) {
    throw new Error(
      `aggregator-rate requires column_def.column_name (column_id=${column_def.column_id})`
    )
  }
  const alias = `${column_def.column_name}_${column_index}`
  return {
    sql: `SUM(${cte_name}.measure_total) / NULLIF(COUNT(${cte_name}.period_key), 0) AS ${alias}`,
    bindings: []
  }
}

export default {
  consumes_params,
  get_cte_name,
  add_cte,
  join_cte,
  emit_outer_select
}
