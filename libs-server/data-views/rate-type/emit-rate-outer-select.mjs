// Outer SELECT emitter shared by the per-game / per-team-play / per-player /
// per-player-play / per-player-route plugins. The denominator CTE
// (`rate_type_total_count`) is registered by the plugin's `add_cte`. The
// numerator comes from one of two sources, selected by `column_def.measure_source`:
//
// - 'plays' / 'gamelogs' (or unset): inline `SUM(measure_expr)` against
//   `nfl_plays` / `player_gamelogs`. Column-def supplies `measure_expr`.
// - 'plays_role_union' / 'snaps' / 'plays_receiver': numerator is a
//   pre-aggregated period CTE materialized via aggregator-rate's CTE shape
//   (see `apply_output_aggregator` in output-aggregator-registry.mjs). The
//   outer expression becomes `SUM(num_cte.measure_total) / MAX(denom)` --
//   `MAX(denom)` because the denominator row count is one per join group but
//   Postgres requires aggregation when the column is not in GROUP BY.
//
// SECURITY: cte names are deterministic identifiers (md5-prefixed); the SQL
// is emitted without bindings.
import aggregator_rate from '../output-aggregator/aggregator-rate.mjs'
import {
  compute_measure_alias,
  is_batchable
} from '../output-aggregator/measure-batch.mjs'

// All rate emits now flow through the pre-aggregated numerator CTE.
// The inline `SUM(measure_expr)` shape (legacy `${table_name}.column / denom`)
// only worked when the main query had `nfl_plays` / `player_gamelogs`
// directly joined, which has never been the case under the column-def
// contract -- the column's own `.with` materializes a per-player CTE that
// the main query joins, so unqualified column refs in `measure_expr` (e.g.
// `comp`, `yards_after_catch`) resolve at the wrong scope. The numerator
// CTE shape sidesteps this by re-materializing the measure against
// nfl_plays inside aggregator-rate's CTE.
export const numerator_via_cte = () => true

export const get_numerator_cte_name = ({ column_def, params, identity_id }) =>
  aggregator_rate.get_cte_name({
    column_def,
    params,
    identity_id,
    period: 'aggregate'
  })

export const emit_rate_outer_select = ({
  column_def,
  cte_name,
  column_index,
  params,
  identity_id
}) => {
  // Alias matches `aggregator-rate.emit_outer_select` and the legacy
  // `${column_name}_${column_index}` shape so where-string.mjs's
  // `use_having` fallback at L32 references the right column.
  if (!column_def.column_name) {
    throw new Error(
      `emit_rate_outer_select requires column_def.column_name (column_id=${column_def.column_id})`
    )
  }
  const alias = `${column_def.column_name}_${column_index}`

  const num_cte = get_numerator_cte_name({ column_def, params, identity_id })
  // Numerator CTE is materialized at `period='aggregate'` grain (one row per
  // (pid|team_code, year)) so the join is 1:1. MAX wraps both values so
  // Postgres accepts the expression alongside the outer query's SELECT-
  // driven GROUP BY -- since the join is 1:1, MAX returns the single
  // value. CAST to DECIMAL avoids integer division truncation (legacy
  // get_rate_type_sql had the same CAST).
  //
  // Batched numerator CTEs name each measure `m_<hash>`; role-union retains
  // the legacy singleton `measure_total` column.
  const measure_alias = is_batchable({ column_def })
    ? compute_measure_alias({ column_def, params, identity_id })
    : 'measure_total'
  return {
    sql: `CAST(MAX(${num_cte}.${measure_alias}) AS DECIMAL) / NULLIF(CAST(MAX(${cte_name}.rate_type_total_count) AS DECIMAL), 0) AS ${alias}`,
    bindings: []
  }
}
