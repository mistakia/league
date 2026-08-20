import crypto from 'crypto'

import { add_period_cte } from './build-period-cte.mjs'
import { consumed_params_signature } from './consumed-params-signature.mjs'
import {
  compute_cte_name,
  compute_group_key,
  compute_measure_alias,
  is_batchable
} from './measure-batch.mjs'
import * as identity_bridge_registry from '../identity-bridge-registry.mjs'
import {
  register_per_period_summary,
  summary_cte_name,
  summary_column_alias
} from './per-period-summary.mjs'

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
  // Batchable sources derive CTE name from the group key with a `count_`
  // prefix so count CTEs share scans across columns with matching scan
  // signatures. Aggregator-rate uses a `rate_` prefix, so rate and count
  // do not cross-share even when group_keys collide; the cosmetic split
  // keeps the two aggregator families clearly distinguished in EXPLAIN.
  if (is_batchable({ column_def })) {
    const group_key = compute_group_key({
      column_def,
      params,
      identity_id,
      period,
      consumes_params: effective
    })
    return compute_cte_name({ group_key, period }).replace(/^rate_/, 'count_')
  }
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

// The period CTE is materialized as before, and a SUMMARY over it is
// registered in the same breath. Both are deferred: the period CTE flushes with
// its measure batch, the summary after, because it selects from it.
export const add_cte = async (args) => {
  await add_period_cte(args)
  const { query_context, column_def, params, cte_name, identity_id } = args
  register_per_period_summary({
    query_context,
    period_cte_name: cte_name,
    is_team: identity_id.startsWith('team'),
    aggregation: 'count',
    measure_alias: resolve_measure_alias({ column_def, params, identity_id }),
    threshold: params?.output?.threshold ?? null
  })
}

const resolve_measure_alias = ({ column_def, params, identity_id }) =>
  is_batchable({ column_def })
    ? compute_measure_alias({ column_def, params, identity_id })
    : 'measure_total'

const resolve_team_join_target = ({ query_context, params, source }) => {
  if (query_context.row_grain_id === 'team') return query_context.team_reference
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
  identity_bridge_registry.apply_bridge({
    query_context,
    from: 'player_year',
    to: 'team_year',
    mode: 'default',
    params,
    source
  })
  return 'player_year_teams.team'
}

export const join_cte = ({
  query_context,
  cte_name,
  identity_id,
  params = {},
  column_def = null
}) => {
  const { players_query, pid_reference, year_reference, row_axes } =
    query_context
  const is_team = identity_id.startsWith('team')
  const team_target = is_team
    ? resolve_team_join_target({
        query_context,
        params,
        source: column_def?.source || null
      })
    : null
  // Join the SUMMARY, not the period CTE. The period CTE is at
  // (subject, period_key, year) grain -- finer than the outer row, so joining
  // it directly cross-multiplies against every other per-period column in the
  // view. The summary is one row per (subject, year) and joins 1:1.
  const summary_name = summary_cte_name({ period_cte_name: cte_name })
  players_query.leftJoin(summary_name, function () {
    if (is_team) {
      this.on(`${summary_name}.team_code`, '=', team_target)
    } else {
      this.on(`${summary_name}.pid`, '=', pid_reference)
    }
    if (row_axes.includes('year') && year_reference) {
      this.andOn(`${summary_name}.year`, '=', year_reference)
    }
  })
}

export const emit_outer_select = ({
  column_def,
  cte_name,
  column_index,
  params,
  identity_id
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
  // The counting happens in the summary CTE now, so this is a read of one
  // already-reduced value. MAX picks it out of a group of one -- a CTE column
  // is not functionally dependent on the outer GROUP BY the way a grouped
  // primary key is, so the bare reference is a 42803.
  const summary_name = summary_cte_name({ period_cte_name: cte_name })
  const summary_alias = summary_column_alias({
    aggregation: 'count',
    measure_alias: resolve_measure_alias({ column_def, params, identity_id }),
    threshold
  })
  return {
    sql: `MAX(${summary_name}.${summary_alias}) AS ${alias}`,
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
