import crypto from 'crypto'

import { add_period_cte } from './build-period-cte.mjs'
import { consumed_params_signature } from './consumed-params-signature.mjs'
import { is_historical_team_mode } from '../historical-team-mode.mjs'
import {
  add_player_year_teams_cte,
  ensure_player_year_teams_join
} from '../add-player-year-teams-cte.mjs'

export const consumes_params = ['year', 'nfl_week_id', 'seas_type']

const valid_period = (period) => period === 'game' || period === 'season'

export const get_cte_name = ({ column_def, params, identity_id, period }) => {
  if (!valid_period(period)) {
    throw new Error(
      `count aggregator requires period in (game, season); got ${period}`
    )
  }
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
  return `count_${period}_${hash}`
}

export const add_cte = add_period_cte

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
  if (is_historical_team_mode({ params, splits: query_context.splits })) {
    const data_view_options = query_context.data_view_options
    if (data_view_options) {
      add_player_year_teams_cte({
        players_query: query_context.players_query,
        params,
        splits: query_context.splits,
        data_view_options
      })
      ensure_player_year_teams_join({
        players_query: query_context.players_query,
        data_view_options,
        splits: query_context.splits
      })
      return `${data_view_options.player_year_teams_cte_name}.team`
    }
  }
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

const op_sql = (op) => {
  const allowed = ['>=', '>', '<=', '<', '=', '<>']
  if (!allowed.includes(op)) throw new Error(`Unsupported threshold op: ${op}`)
  return op
}

export const emit_outer_select = ({
  column_def,
  cte_name,
  column_index,
  params
}) => {
  const threshold = params?.output?.threshold
  if (!threshold || threshold.op == null || threshold.value == null) {
    throw new Error(
      'count aggregator requires params.output.threshold {op, value}'
    )
  }
  if (!column_def.column_name) {
    throw new Error(
      `aggregator-count requires column_def.column_name (column_id=${column_def.column_id})`
    )
  }
  const alias = `${column_def.column_name}_${column_index}`
  const op = op_sql(threshold.op)
  return {
    sql: `COUNT(DISTINCT ${cte_name}.period_key) FILTER (WHERE ${cte_name}.measure_total ${op} ?) AS ${alias}`,
    bindings: [threshold.value]
  }
}

export default {
  consumes_params,
  get_cte_name,
  add_cte,
  join_cte,
  emit_outer_select
}
