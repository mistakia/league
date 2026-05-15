// Coalesces co-locatable measures into a single materialized CTE.
//
// Two measures share a CTE iff their group_key matches: same measure_source,
// same period, same identity, same pid_columns, same measure_predicate, same
// apply_filters body, same team_unit, same consumed-params subset.
//
// Each measure in a batch contributes one `SUM(<measure_expr>) AS m_<hash>`
// column to the CTE. The outer SELECT (aggregator-rate / aggregator-count
// / emit-rate-outer-select) references that aliased column instead of the
// legacy `measure_total` singleton.
//
// Materialization is deferred: `register_measure` accumulates measures into
// `query_context.measure_batches`; the dispatcher calls `flush` after the
// per-column dispatch loop to emit one `withMaterialized` per batch.
//
// SECURITY: `apply_filters.toString()` is used solely as identity for the
// batch key, not as SQL. Knex bindings inside apply_filters preserve their
// parameterization at materialization time.
import crypto from 'crypto'

import { consumed_params_signature } from './consumed-params-signature.mjs'

const h12 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 12)

// Source families that may be batched. `plays_role_union` is excluded
// because its inner UNION-ALL shape is per-column (role_attributions vary
// per column-def); two role-union columns would not share a scan.
const BATCHABLE_SOURCES = new Set([
  'plays',
  'gamelogs',
  'snaps',
  'plays_receiver',
  undefined // back-compat: gamelogs default
])

export const is_batchable = ({ column_def }) =>
  BATCHABLE_SOURCES.has(column_def.measure_source)

export const compute_group_key = ({
  column_def,
  params,
  identity_id,
  period,
  consumes_params
}) => {
  const sig = {
    measure_source: column_def.measure_source ?? null,
    period,
    identity_id,
    pid_columns: column_def.pid_columns
      ? [...column_def.pid_columns].sort()
      : null,
    measure_predicate: column_def.measure_predicate
      ? column_def.measure_predicate({ params, identity_id })
      : null,
    apply_filters_body: column_def.apply_filters
      ? column_def.apply_filters.toString()
      : null,
    team_unit: params?.team_unit ?? null,
    params: consumed_params_signature({ params, consumes_params })
  }
  return JSON.stringify(sig)
}

// Within-batch measure alias. Stable across calls for the same
// (column_id, rendered measure_expr) pair; two columns whose measure_expr
// renders to the same SQL fragment dedupe to the same alias.
export const compute_measure_alias = ({ column_def, params, identity_id }) => {
  if (!column_def.measure_expr) {
    // Role-union path uses its own materialization; this helper should not
    // be called for non-batchable column-defs. Guard defensively.
    throw new Error(
      `measure-batch: column_def lacks measure_expr (column_id=${column_def.column_id})`
    )
  }
  const expr = column_def.measure_expr({
    table_name: resolve_source_table(column_def.measure_source),
    params,
    identity_id
  })
  return `m_${h12(JSON.stringify({ column_id: column_def.column_id, expr }))}`
}

const SOURCE_TABLES = {
  plays: 'nfl_plays',
  gamelogs: 'player_gamelogs',
  snaps: 'nfl_snaps',
  plays_receiver: 'nfl_plays_receiver'
}

export const resolve_source_table = (measure_source) =>
  SOURCE_TABLES[measure_source] ?? 'player_gamelogs'

export const compute_cte_name = ({ group_key, period }) =>
  `rate_${period}_${h12(group_key)}`

// Idempotent registration. Returns { cte_name, measure_alias }.
// `common` is captured on the first register for a given group_key; subsequent
// registers reuse it. Caller is responsible for passing identical `common` for
// the same group_key (the group_key components subsume the relevant fields).
export const register_measure = ({
  query_context,
  group_key,
  cte_name,
  measure_alias,
  measure_expr,
  common
}) => {
  if (!query_context.measure_batches) {
    query_context.measure_batches = new Map()
  }
  let batch = query_context.measure_batches.get(group_key)
  if (!batch) {
    batch = { cte_name, common, measures: new Map() }
    query_context.measure_batches.set(group_key, batch)
  }
  if (!batch.measures.has(measure_alias)) {
    batch.measures.set(measure_alias, measure_expr)
  }
  return { cte_name, measure_alias }
}

// Walk all registered batches and materialize each as a single CTE on
// query_context.players_query. Safe to call once after the per-column
// dispatch loop; subsequent calls no-op via `applied_output_ctes`.
export const flush = ({ query_context, build_batched_period_cte }) => {
  if (!query_context.measure_batches) return
  for (const [, batch] of query_context.measure_batches) {
    if (query_context.applied_output_ctes.has(batch.cte_name)) continue
    const sub = build_batched_period_cte({
      ...batch.common,
      measures: [...batch.measures.entries()].map(([alias, expr]) => ({
        alias,
        measure_expr: expr
      })),
      query_context
    })
    query_context.players_query.withMaterialized(batch.cte_name, sub)
    query_context.applied_output_ctes.add(batch.cte_name)
  }
}
