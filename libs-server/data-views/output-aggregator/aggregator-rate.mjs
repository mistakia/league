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
import { emit_year_match } from '../param-utils.mjs'
import { get_team_attribution } from '../resolve-team-join-target.mjs'

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
  'matchup_opponent_type',
  'team_attribution'
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

// Wrapper that enriches the add_period_cte call with the pre-hash group_key
// so the measure_batches map carries a transparent canonical key rather than
// the already-hashed cte_name string.
export const add_cte = (args) => {
  const { column_def, params, identity_id, period } = args
  if (is_batchable({ column_def })) {
    const effective = column_def.consumes_params_extra
      ? [...consumes_params, ...column_def.consumes_params_extra]
      : consumes_params
    const group_key = compute_group_key({
      column_def,
      params,
      identity_id,
      period,
      consumes_params: effective
    })
    return add_period_cte({ ...args, group_key })
  }
  return add_period_cte(args)
}

// Derive the team-side join target for a team-keyed CTE consumed by a
// player-cell view. Subject 'team' uses the team identity reference directly;
// matchup branches join against the opponents CTE attached upstream. For the
// default player-cell case, route through the player_year->team_year identity
// bridge so historical-team-mode is structural rather than a runtime branch.
// `source` is forwarded to the bridge so its resolve_year_range can consult
// source.year_default when neither query_context.year_range nor params.year
// is set (e.g. team-stat columns in offseason).
// Exported so the per_game denominator join (rate-type-per-game.mjs) projects
// onto the SAME team as this numerator -- both apply the player_year->team_year
// bridge and return player_year_teams.team, eliminating the historical numerator
// vs current_nfl_team denominator split for offseason team-changers.
export const resolve_team_join_target = ({ query_context, params, source }) => {
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
  // team_attribution selects which team a player-cell team rate stat attaches
  // to. 'current' (forward-looking projection) joins on player.current_nfl_team
  // WITHOUT registering the player_year->team_year bridge; 'historical' (default)
  // routes through the bridge below.
  if (get_team_attribution(params) === 'current')
    return 'player.current_nfl_team'
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
  players_query.leftJoin(cte_name, function () {
    if (is_team) {
      this.on(`${cte_name}.team_code`, '=', team_target)
    } else {
      this.on(`${cte_name}.pid`, '=', pid_reference)
    }
    if (row_axes.includes('year') && year_reference) {
      // Correlate the aggregator CTE year to the base-year anchor THROUGH the
      // offset via the shared primitive (single `= ref+k`, range BETWEEN, or
      // `= ref` with no offset) -- replaces the inline offset branch.
      emit_year_match({
        builder: this,
        db,
        year_reference,
        source: {},
        key_columns: { year: 'year' },
        params,
        ref: cte_name
      })
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
  // Round the rate value to column_def.decimals when declared, so rate render
  // matches the column's season-total rounding. decimals null (the default)
  // leaves the division unwrapped, preserving today's unrounded rate emit.
  const division = `SUM(${cte_name}.${measure_alias}) / NULLIF(COUNT(${cte_name}.period_key), 0)`
  const value =
    column_def.decimals != null
      ? `ROUND(${division}, ${column_def.decimals})`
      : division
  return {
    sql: `${value} AS ${alias}`,
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
