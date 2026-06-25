import { resolve_team_join_target } from './resolve-team-join-target.mjs'
import { year_offset_range_applies } from './year-offset-range.mjs'

// Escape a literal for inline SQL emission. Mirrors the minimal quoting the
// rest of this file already relies on -- raw template-literal interpolation
// of column params -- but applies it consistently to source.extra_predicates
// values so the correlated-subquery emitter doesn't smuggle in unquoted
// strings or unescaped quotes.
const format_sql_literal = (value) => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
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
// every source_id / adp_format_id / etc.
const format_extra_predicates_sql = (source, column_params, inner_table) => {
  if (typeof source?.extra_predicates !== 'function') return ''
  const extras = source.extra_predicates(column_params) || []
  return extras
    .map((p) => {
      const op = p.op || '='
      const col = p.column.includes('.')
        ? p.column
        : `${inner_table}.${p.column}`
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

const get_select_string = ({
  column_id,
  column_params,
  column_index,
  column_definition,
  table_name,
  output_select_mapping = {},
  row_axes,
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

  const join_table_name =
    is_main_select && column_definition.join_table_name
      ? column_definition.join_table_name({
          table_name,
          params: column_params,
          column_index,
          row_axes
        })
      : !is_main_select && column_definition.table_name
        ? column_definition.table_name
        : table_name
  const column_value = `"${join_table_name}"."${column_definition.column_name}"`

  const select_func = is_main_select
    ? column_definition.main_select
    : column_definition.with_select
  const should_yield_to_year_offset_override =
    is_main_select &&
    year_offset_range_applies(column_definition, column_params) &&
    column_definition.main_select_string_year_offset_range
  if (select_func && !should_yield_to_year_offset_override) {
    return {
      select: select_func({
        table_name,
        params: column_params,
        column_index,
        row_axes,
        data_view_options,
        query_context
      }),
      group_by:
        is_main_select && column_definition.main_group_by
          ? column_definition.main_group_by({
              table_name,
              params: column_params,
              column_index,
              row_axes,
              data_view_options,
              query_context
            })
          : []
    }
  }

  const select_expression = column_value
  const select_as =
    is_main_select && column_definition.select_as
      ? column_definition.select_as({ params: column_params })
      : column_definition.column_name

  const has_year_offset_range =
    is_main_select &&
    year_offset_range_applies(column_definition, column_params)

  let final_select_expression
  if (is_main_select && has_year_offset_range) {
    const min_year_offset = Math.min(...column_params.year_offset)
    const max_year_offset = Math.max(...column_params.year_offset)

    // Use centralized references
    const year_clause = data_view_options.year_reference
    // Team-grained sources correlate on their team column, not pid; the
    // correlated subquery must use the same projection target that
    // apply_team_stats_join would use in the non-offset-range JOIN path
    // (matchup opponent, per-season team, or current_nfl_team). The team
    // column is source-specific (nfl_team_seasonlogs uses `tm`,
    // espn_team_win_rates_index uses `team`, the dvoa/pff seasonlogs use
    // `nfl_team`) -- read it from source.key_columns.team rather than assuming
    // `nfl_team`, which emitted a non-existent column for the `tm`/`team`
    // sources (invalid SQL the snapshot harness could not catch).
    const is_team_grain =
      typeof column_definition.source?.grain === 'string' &&
      column_definition.source.grain.startsWith('team')
    const correlation_key = is_team_grain
      ? column_definition.source?.key_columns?.team || 'nfl_team'
      : 'pid'
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

    // Anchored offset (year split): correlate to the year_reference through the
    // range. Otherwise emit the explicit `year IN (...)` list produced by
    // crossing source.year_default with the offset range. A source that
    // declares no year_default yields no predicate -- these are CTE-backed
    // sources (e.g. the from-plays CTEs) whose own builder already restricts
    // the relation to the offset-expanded years; the year basis is an explicit
    // source contract (year_default present -> emit it) rather than the prior
    // un-asserted "the CTE pre-filtered itself" trust branch, which silently
    // dropped the year filter for any CTE source that had NOT pre-filtered.
    let year_predicate
    if (year_clause) {
      year_predicate = ` AND ${inner_table}.year BETWEEN ${year_clause} + ${min_year_offset} AND ${year_clause} + ${max_year_offset}`
    } else {
      const in_list = compute_year_in_list(
        source,
        column_params,
        min_year_offset,
        max_year_offset
      )
      year_predicate = in_list ? ` AND ${inner_table}.year IN (${in_list})` : ''
    }

    // Reapply source.extra_predicates whenever the subquery re-scans a real
    // source table (source.table set), not just when the inner relation name
    // differs from the outer alias. `inner_qualifies_via_alias` was a leaky
    // proxy: a real-table source with no table_alias has table_name ===
    // source.table, so it read false and silently dropped its discriminators
    // (e.g. player-espn-score averaging across every seas_type). Match the
    // documented intent -- "source declares a real table -> reapply the
    // discriminators the outer JOIN normally enforces" -- by keying on
    // source.table. CTE-backed sources (no source.table) carry their
    // discriminators in the CTE and need none here.
    const extra_predicates_sql = source?.table
      ? format_extra_predicates_sql(source, column_params, inner_table)
      : ''

    if (column_definition.has_numerator_denominator) {
      // Percentage columns (completion %, INT %, share %, ...) scale by 100 and
      // round to match their season render; ratio columns (Y/A, aDOT, YAC/C,
      // ...) keep the raw pooled quotient. The double-SUM here sums per-year
      // bigint sub-totals, which Postgres promotes to numeric, so the ratio
      // quotient is not subject to integer-division truncation.
      const num_sum = `SUM(${inner_table}.${select_as}_numerator)`
      const den_sum = `NULLIF(SUM(${inner_table}.${select_as}_denominator), 0)`
      const rate_expr = column_definition.is_percentage
        ? `ROUND(100.0 * ${num_sum} / ${den_sum}, 2)`
        : `${num_sum} / ${den_sum}`
      final_select_expression = `(SELECT ${rate_expr} FROM ${inner_table} WHERE ${inner_table}.${correlation_key} = ${correlation_ref}${year_predicate}${extra_predicates_sql})`
    } else if (column_definition.main_select_string_year_offset_range) {
      final_select_expression =
        column_definition.main_select_string_year_offset_range({
          table_name: join_table_name,
          params: column_params,
          data_view_options,
          query_context
        })
    } else {
      // Reduce the offset window with the column's declared aggregate (default
      // SUM). Non-additive season statistics (means, mins, maxes, ranks)
      // override this so a multi-year window is not silently summed -- see
      // player-adp-column-definitions range_offset_aggregate.
      const range_offset_aggregate =
        column_definition.range_offset_aggregate || 'SUM'
      final_select_expression = `(SELECT ${range_offset_aggregate}(${inner_table}.${column_definition.column_name}) FROM ${inner_table} WHERE ${inner_table}.${correlation_key} = ${correlation_ref}${year_predicate}${extra_predicates_sql})`
    }
  } else {
    final_select_expression = select_expression
  }

  const group_by =
    !is_main_select || has_year_offset_range ? [] : [column_value]

  // TODO unused currently
  // if (is_main_select && column_definition.main_group_by) {
  //   group_by.push(...column_definition.main_group_by({ table_name, params: column_params, column_index, rate_type_table_name, row_axes }))
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
