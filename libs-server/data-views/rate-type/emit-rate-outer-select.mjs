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

const INLINE_SOURCES = new Set(['plays', 'gamelogs', undefined, null])

export const numerator_via_cte = ({ column_def }) =>
  !INLINE_SOURCES.has(column_def.measure_source)

export const get_numerator_cte_name = ({ column_def, params, identity_id }) =>
  aggregator_rate.get_cte_name({
    column_def,
    params,
    identity_id,
    period: 'game'
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

  if (numerator_via_cte({ column_def })) {
    const num_cte = get_numerator_cte_name({ column_def, params, identity_id })
    return {
      sql: `SUM(${num_cte}.measure_total) / NULLIF(MAX(${cte_name}.rate_type_total_count), 0) AS ${alias}`,
      bindings: []
    }
  }

  const table_name =
    column_def.measure_source === 'plays' ? 'nfl_plays' : 'player_gamelogs'
  const measure_expr = column_def.measure_expr({
    table_name,
    params,
    identity_id
  })
  const predicate_sql = column_def.measure_predicate
    ? column_def.measure_predicate({ params, identity_id })
    : null
  const numerator = predicate_sql
    ? `SUM(CASE WHEN ${predicate_sql} THEN ${measure_expr} ELSE 0 END)`
    : `SUM(${measure_expr})`
  return {
    sql: `${numerator} / NULLIF(${cte_name}.rate_type_total_count, 0) AS ${alias}`,
    bindings: []
  }
}
