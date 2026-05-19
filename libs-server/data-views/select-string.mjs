import { resolve_team_join_target } from './resolve-team-join-target.mjs'

// Escape a literal for inline SQL emission. Mirrors the minimal quoting the
// rest of this file already relies on -- raw template-literal interpolation
// of column params -- but applies it consistently to source.extra_predicates
// values so the correlated-subquery emitter doesn't smuggle in unquoted
// strings or unescaped quotes.
const format_sql_literal = (value) => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return `'${String(value).replace(/'/g, "''")}'`
}

// Compute the year-set produced by source.year_default crossed with a
// year_offset range, for sources whose attach rule would emit an
// `year IN (...)` predicate on the join (player-family-to-player-year's
// no-year_reference branch). Returned as a sorted IN-list fragment, or null
// if the source declares no year_default.
const compute_year_in_list = (source, column_params, min_off, max_off) => {
  if (typeof source?.year_default !== 'function') return null
  const v = source.year_default(column_params)
  if (v == null) return null
  const anchors = (Array.isArray(v) ? v : [v])
    .map(Number)
    .filter((n) => Number.isFinite(n))
  if (!anchors.length) return null
  const years = new Set()
  for (const anchor of anchors) {
    for (let off = min_off; off <= max_off; off++) years.add(anchor + off)
  }
  return [...years].sort((a, b) => a - b).join(',')
}

// Emit a WHERE-fragment string that reapplies source.extra_predicates against
// the inner FROM relation. Needed because the correlated SUM subquery is
// re-scanned from the underlying table (not the outer JOIN alias), so the
// alias's discriminator predicates must be re-emitted to avoid summing across
// every source_id / adp_type / etc.
const format_extra_predicates_sql = (source, column_params, inner_table) => {
  if (typeof source?.extra_predicates !== 'function') return ''
  const extras = source.extra_predicates(column_params) || []
  return extras
    .map((p) => {
      const op = p.op || '='
      const col = p.column.includes('.') ? p.column : `${inner_table}.${p.column}`
      if (op === '=') return ` AND ${col} = ${format_sql_literal(p.value)}`
      if (op === 'in') {
        const list = (p.value || []).map(format_sql_literal).join(', ')
        return ` AND ${col} IN (${list})`
      }
      if (op === 'between') {
        return ` AND ${col} BETWEEN ${format_sql_literal(p.value[0])} AND ${format_sql_literal(p.value[1])}`
      }
      throw new Error(`Unknown source.extra_predicates op: ${op}`)
    })
    .join('')
}

export const get_rate_type_sql = ({
  table_name,
  column_name,
  rate_type_table_name
}) =>
  `CAST(${table_name}.${column_name} AS DECIMAL) / NULLIF(CAST(${rate_type_table_name}.rate_type_total_count AS DECIMAL), 0)`

const get_select_string = ({
  column_id,
  column_params,
  column_index,
  column_definition,
  table_name,
  rate_type_column_mapping,
  output_select_mapping = {},
  splits,
  is_main_select = false,
  data_view_options = {},
  query_context = null
}) => {
  // Output-aggregator dispatch (Phase C step 1): when a retrofitted column
  // is invoked with `params.output`, the dispatcher pre-resolved the outer
  // SELECT via the aggregator plugin. Return its raw SQL here so the main
  // SELECT uses the aggregator-emitted expression instead of the legacy
  // main_select / column-value path. Only fires for is_main_select; WITH
  // selects never reference the aggregator CTE.
  if (is_main_select) {
    const output_select = output_select_mapping[`${column_id}_${column_index}`]
    if (output_select && output_select.sql) {
      return {
        select: [output_select],
        group_by: []
      }
    }
  }

  const rate_type_table_name =
    rate_type_column_mapping[`${column_id}_${column_index}`]
  const join_table_name =
    is_main_select && column_definition.join_table_name
      ? column_definition.join_table_name({
          table_name,
          params: column_params,
          column_index,
          rate_type_table_name,
          splits
        })
      : !is_main_select && column_definition.table_name
        ? column_definition.table_name
        : table_name
  const column_value = `"${join_table_name}"."${column_definition.column_name}"`

  const get_select_expression = () => {
    if (rate_type_table_name) {
      return get_rate_type_sql({
        table_name: join_table_name,
        column_name: column_definition.column_name,
        rate_type_table_name
      })
    }
    return column_value
  }

  const select_func = is_main_select
    ? column_definition.main_select
    : column_definition.with_select
  if (select_func) {
    return {
      select: select_func({
        table_name,
        params: column_params,
        column_index,
        rate_type_table_name,
        splits
      }),
      group_by:
        is_main_select && column_definition.main_group_by
          ? column_definition.main_group_by({
              table_name,
              params: column_params,
              column_index,
              rate_type_table_name,
              splits
            })
          : []
    }
  }

  const select_expression = get_select_expression()
  const select_as =
    is_main_select && column_definition.select_as
      ? column_definition.select_as({ params: column_params })
      : column_definition.column_name

  const has_year_offset_range =
    is_main_select &&
    column_params.year_offset &&
    Array.isArray(column_params.year_offset) &&
    column_params.year_offset.length > 1 &&
    column_params.year_offset[0] !== column_params.year_offset[1]

  let final_select_expression
  if (is_main_select && has_year_offset_range) {
    const min_year_offset = Math.min(...column_params.year_offset)
    const max_year_offset = Math.max(...column_params.year_offset)

    // Use centralized references
    const year_clause = data_view_options.year_reference
    // Team-grained sources have nfl_team, not pid; the correlated subquery
    // must use the same projection target that apply_team_stats_join would
    // use in the non-offset-range JOIN path (matchup opponent, per-season
    // team, or current_nfl_team).
    const is_team_grain =
      typeof column_definition.source?.grain === 'string' &&
      column_definition.source.grain.startsWith('team')
    const correlation_key = is_team_grain ? 'nfl_team' : 'pid'
    const correlation_ref = is_team_grain
      ? resolve_team_join_target({
          query_context: query_context || { data_view_options },
          params: column_params
        })
      : data_view_options.pid_reference

    // The correlated SUM subquery's inner FROM must name a relation visible
    // in its own scope. join_table_name may be an outer-query JOIN alias
    // (e.g. the hashed alias for `player_adp_index`), and Postgres does not
    // expose outer FROM-clause aliases as relations to subqueries -- only
    // their columns are correlatable. When the source declares a real table,
    // re-scan that table directly inside the subquery and reapply the
    // discriminator predicates (year-set + source.extra_predicates) that the
    // outer JOIN normally enforces. CTE-backed sources (no source.table)
    // keep referencing the outer relation by name -- CTE names are visible
    // throughout the WITH block.
    const source = column_definition.source
    const inner_table = source?.table || join_table_name
    const inner_qualifies_via_alias = inner_table !== join_table_name

    let year_predicate
    if (year_clause) {
      year_predicate = ` AND ${inner_table}.year BETWEEN ${year_clause} + ${min_year_offset} AND ${year_clause} + ${max_year_offset}`
    } else if (inner_qualifies_via_alias) {
      const in_list = compute_year_in_list(
        source,
        column_params,
        min_year_offset,
        max_year_offset
      )
      year_predicate = in_list ? ` AND ${inner_table}.year IN (${in_list})` : ''
    } else {
      // CTE-backed source: the CTE builder already restricted to the offset
      // year range upstream, so no per-row year anchor is needed here.
      year_predicate = ''
    }

    const extra_predicates_sql = inner_qualifies_via_alias
      ? format_extra_predicates_sql(source, column_params, inner_table)
      : ''

    if (column_definition.has_numerator_denominator) {
      final_select_expression = `(SELECT SUM(${inner_table}.${select_as}_numerator) / NULLIF(SUM(${inner_table}.${select_as}_denominator), 0) FROM ${inner_table} WHERE ${inner_table}.${correlation_key} = ${correlation_ref}${year_predicate}${extra_predicates_sql})`
    } else if (column_definition.main_select_string_year_offset_range) {
      final_select_expression =
        column_definition.main_select_string_year_offset_range({
          table_name: join_table_name,
          params: column_params,
          data_view_options
        })
    } else {
      final_select_expression = `(SELECT SUM(${inner_table}.${column_definition.column_name}) FROM ${inner_table} WHERE ${inner_table}.${correlation_key} = ${correlation_ref}${year_predicate}${extra_predicates_sql})`
    }

    if (rate_type_table_name) {
      const rate_year_predicate = year_clause
        ? ` AND ${rate_type_table_name}.year BETWEEN ${year_clause} + ${min_year_offset} AND ${year_clause} + ${max_year_offset}`
        : ''
      final_select_expression = `${final_select_expression} / NULLIF((SELECT CAST(SUM(${rate_type_table_name}.rate_type_total_count) AS DECIMAL) FROM ${rate_type_table_name} WHERE ${rate_type_table_name}.${correlation_key} = ${correlation_ref}${rate_year_predicate}), 0)`
    }
  } else {
    final_select_expression = select_expression
  }

  const group_by =
    !is_main_select || has_year_offset_range
      ? []
      : [
          column_value,
          rate_type_table_name
            ? `${rate_type_table_name}.rate_type_total_count`
            : null
        ]

  // TODO unused currently
  // if (is_main_select && column_definition.main_group_by) {
  //   group_by.push(...column_definition.main_group_by({ table_name, params: column_params, column_index, rate_type_table_name, splits }))
  // }

  const select_alias = is_main_select
    ? `${select_as}_${column_index}`
    : select_as

  return {
    select: [`${final_select_expression} AS "${select_alias}"`],
    group_by: group_by.filter(Boolean)
  }
}

export const get_with_select_string = (params) => get_select_string(params)

export const get_main_select_string = (params) =>
  get_select_string({ ...params, is_main_select: true })
