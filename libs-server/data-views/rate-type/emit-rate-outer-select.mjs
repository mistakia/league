// measure_source on the column def selects the denominator table (plays vs gamelogs).
export const emit_rate_outer_select = ({
  column_def,
  cte_name,
  column_index,
  params,
  identity_id
}) => {
  const alias = `rate_value_${column_index}`
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
