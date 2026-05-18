import crypto from 'crypto'

import db from '#db'

import { add_period_cte } from './build-period-cte.mjs'
import { consumed_params_signature } from './consumed-params-signature.mjs'
import {
  compute_cte_name,
  compute_group_key,
  compute_measure_alias,
  is_batchable
} from './measure-batch.mjs'
import * as identity_bridge_registry from '../identity-bridge-registry.mjs'

// consumes_params drives both CTE name hashing (so distinct param sets emit
// distinct CTEs) and consumed_params_signature for cache keys. `week` and
// `year_offset` must be included because join_cte / build_period_cte are
// invoked once per distinct CTE -- two column instances sharing a CTE
// alias would share both the JOIN condition and the inner filters, which
// is incorrect when the instances differ in week range (mutually-exclusive
// inner filter) or year_offset (different JOIN arithmetic).
export const consumes_params = [
  'year',
  'year_offset',
  'week',
  'nfl_week_id',
  'seas_type',
  'matchup_opponent_type'
]

export const get_cte_name = ({ column_def, params, identity_id, period }) => {
  const effective = column_def.consumes_params_extra
    ? [...consumes_params, ...column_def.consumes_params_extra]
    : consumes_params
  // Batchable sources derive CTE name from the group key so multiple
  // column-defs that share a scan signature collapse to one CTE. Role-union
  // (and any future non-batchable) sources keep per-column-id hashing.
  if (is_batchable({ column_def })) {
    const group_key = compute_group_key({
      column_def,
      params,
      identity_id,
      period,
      consumes_params: effective
    })
    return compute_cte_name({ group_key, period })
  }
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

// Derive the team-side join target for a team-keyed CTE consumed by a
// player-cell view. Subject 'team' uses the team identity reference directly;
// matchup branches join against the opponents CTE attached upstream. For the
// default player-cell case, route through the player_year->team_year identity
// bridge so historical-team-mode is structural rather than a runtime branch.
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
  identity_bridge_registry.apply_bridge({
    query_context,
    from: 'player_year',
    to: 'team_year',
    mode: 'default',
    params
  })
  return 'player_year_teams.team'
}

// Resolve params.year_offset into [min, max]; null when no offset.
const resolve_year_offset_range = (params) => {
  const raw = params && params.year_offset
  if (raw == null) return null
  const arr = Array.isArray(raw) ? raw : [raw, raw]
  if (!arr.length) return null
  const nums = arr.map(Number).filter((n) => Number.isFinite(n))
  if (!nums.length) return null
  return [Math.min(...nums), Math.max(...nums)]
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
  const offset_range = resolve_year_offset_range(params)
  players_query.leftJoin(cte_name, function () {
    if (is_team) {
      this.on(`${cte_name}.team_code`, '=', team_target)
    } else {
      this.on(`${cte_name}.pid`, '=', pid_reference)
    }
    if (splits.includes('year') && year_reference) {
      if (offset_range) {
        const [min_off, max_off] = offset_range
        if (min_off === max_off) {
          this.andOn(
            db.raw(`${cte_name}.year = ${year_reference} + ?`, [min_off])
          )
        } else {
          this.andOn(
            db.raw(
              `${cte_name}.year BETWEEN ${year_reference} + ? AND ${year_reference} + ?`,
              [min_off, max_off]
            )
          )
        }
      } else {
        this.andOn(`${cte_name}.year`, '=', year_reference)
      }
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
  if (!column_def.column_name) {
    throw new Error(
      `aggregator-rate requires column_def.column_name (column_id=${column_def.column_id})`
    )
  }
  const alias = `${column_def.column_name}_${column_index}`
  // Batched CTEs name each measure `m_<hash>`. Role-union keeps the legacy
  // `measure_total` singleton column.
  const measure_alias = is_batchable({ column_def })
    ? compute_measure_alias({ column_def, params, identity_id })
    : 'measure_total'
  return {
    sql: `SUM(${cte_name}.${measure_alias}) / NULLIF(COUNT(${cte_name}.period_key), 0) AS ${alias}`,
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
