// The per-period output family: evaluate the measure per period, then reduce
// ACROSS periods. `count` counts the periods clearing a threshold; `mean`
// averages the per-period values.
//
// Both are the same machinery over the same scan, differing only in the
// summary column they ask for, so they are one factory rather than two
// aggregators that must be kept in agreement. That sharing is not cosmetic:
// `get_cte_name` does not read the aggregation, so a count and a mean of the
// same measure over the same period land in ONE period CTE and ONE summary
// carrying two columns -- one scan for both questions.
//
// The other family is `pooled`, where `period` names a DENOMINATOR UNIT
// (games played, team plays, routes) rather than a partition of time, and one
// combine runs over the whole scope. `rate` lives there. The two vocabularies
// are disjoint on purpose: a `mean per team_play` is not a thing, and a
// `rate per season` is spelled by scoping the request.
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

// The partition vocabulary. A period here divides the SPAN; a denominator unit
// belongs to the pooled family and is refused by normalize-output-param.
export const PER_PERIOD_PERIODS = Object.freeze(['game', 'season'])

const valid_period = (period) => PER_PERIOD_PERIODS.includes(period)

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

export const create_per_period_aggregator = ({
  aggregation,
  requires_threshold
}) => {
  const label = `${aggregation} aggregator`

  const read_threshold = ({ params }) => {
    const threshold = params?.output?.threshold
    if (!requires_threshold) return null
    if (!threshold || threshold.op == null || threshold.value == null) {
      throw new Error(`${label} requires params.output.threshold {op, value}`)
    }
    return threshold
  }

  const get_cte_name = ({ column_def, params, identity_id, period }) => {
    if (!valid_period(period)) {
      throw new Error(
        `${label} requires period in (${PER_PERIOD_PERIODS.join(', ')}); got ${period}`
      )
    }
    const effective = column_def.consumes_params_extra
      ? [...consumes_params, ...column_def.consumes_params_extra]
      : consumes_params
    // The name carries no aggregation, deliberately: a count and a mean of one
    // measure ask two questions of the same scan, so they share the CTE and
    // the summary. Aggregator-rate keeps its own `rate_` prefix, so the pooled
    // and per-period families still do not cross-share.
    if (is_batchable({ column_def })) {
      const group_key = compute_group_key({
        column_def,
        params,
        identity_id,
        period,
        consumes_params: effective
      })
      return compute_cte_name({ group_key, period }).replace(
        /^rate_/,
        'per_period_'
      )
    }
    const key = JSON.stringify({
      column_id: column_def.column_id,
      measure_source: column_def.measure_source,
      identity_id,
      period,
      params: consumed_params_signature({ params, consumes_params: effective })
    })
    const hash = crypto.createHash('md5').update(key).digest('hex').slice(0, 12)
    return `per_period_${period}_${hash}`
  }

  // The period CTE is materialized as before, and a SUMMARY over it is
  // registered in the same breath. Both are deferred: the period CTE flushes
  // with its measure batch, the summary after, because it selects from it.
  const add_cte = async (args) => {
    await add_period_cte(args)
    const { query_context, column_def, params, cte_name, identity_id } = args
    register_per_period_summary({
      query_context,
      period_cte_name: cte_name,
      is_team: identity_id.startsWith('team'),
      aggregation,
      measure_alias: resolve_measure_alias({ column_def, params, identity_id }),
      threshold: read_threshold({ params })
    })
  }

  const join_cte = ({
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
    if (query_context.joined_per_period_summaries?.has(summary_name)) return
    if (!query_context.joined_per_period_summaries) {
      query_context.joined_per_period_summaries = new Set()
    }
    query_context.joined_per_period_summaries.add(summary_name)
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

  const emit_outer_select = ({
    column_def,
    cte_name,
    column_index,
    params,
    identity_id
  }) => {
    const threshold = read_threshold({ params })
    if (!column_def.column_name) {
      throw new Error(
        `${label} requires column_def.column_name (column_id=${column_def.column_id})`
      )
    }
    const alias = `${column_def.column_name}_${column_index}`
    // The reduction happens in the summary CTE now, so this is a read of one
    // already-reduced value. MAX picks it out of a group of one -- a CTE column
    // is not functionally dependent on the outer GROUP BY the way a grouped
    // primary key is, so the bare reference is a 42803.
    const summary_name = summary_cte_name({ period_cte_name: cte_name })
    const summary_alias = summary_column_alias({
      aggregation,
      measure_alias: resolve_measure_alias({ column_def, params, identity_id }),
      threshold
    })
    // A MEAN is in the measure's own units, so it takes the measure's rounding,
    // the way the rate emitters already do. A COUNT is a count of PERIODS and
    // takes none -- rounding it would apply a ratio column's `decimals` to an
    // integer and move every distinct-count count golden while changing no
    // value.
    const value =
      aggregation === 'mean' && column_def.decimals != null
        ? `ROUND(MAX(${summary_name}.${summary_alias}), ${column_def.decimals})`
        : `MAX(${summary_name}.${summary_alias})`
    return {
      sql: `${value} AS ${alias}`,
      bindings: []
    }
  }

  return {
    consumes_params,
    get_cte_name,
    add_cte,
    join_cte,
    emit_outer_select
  }
}
