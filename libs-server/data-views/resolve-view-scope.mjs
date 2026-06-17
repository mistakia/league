// View-level scope resolution. Walks all per-column and where-clause params,
// collects explicit nfl_week_id (and year + seas_type expansions), applies
// year_offset shifts once (skipping lists already pre-shifted upstream, marked
// with year_offset_applied_to_nfl_week_id), and returns a single canonical
// nfl_week_id list that defines the entire result-set scope.
//
// The REG-only default lives here, in one place. Columns/where with no
// explicit nfl_week_id and no explicit seas_type inherit ['REG']. Columns
// that need playoffs override at the column level via params.seas_type or
// params.nfl_week_id.
//
// Output: a deduped, sorted list of nfl_week_id strings. Downstream helpers
// decompose into years/seas_types/weeks via decompose_nfl_weeks().

import {
  apply_year_offset_to_nfl_weeks,
  get_nfl_week_identifiers_for_year,
  parse_nfl_week_identifier
} from '#libs-shared/nfl-week-identifier.mjs'

const DEFAULT_SEAS_TYPE = ['REG']

const normalize_array = (value) => {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

// Expand a (year + seas_type) cross-product into nfl_week_id strings.
// Year-only inputs default seas_type to REG.
const expand_year_seas_type = ({ year, seas_type }) => {
  const years = normalize_array(year)
    .map((y) => parseInt(y, 10))
    .filter((y) => Number.isFinite(y))
  if (!years.length) return []
  const seas_types = normalize_array(seas_type).length
    ? normalize_array(seas_type)
    : DEFAULT_SEAS_TYPE
  const out = []
  for (const y of years) {
    for (const st of seas_types) {
      out.push(...get_nfl_week_identifiers_for_year({ year: y, seas_type: st }))
    }
  }
  return out
}

// Resolve a params object's contribution to the view scope. nfl_week_id is
// canonical; year+seas_type is the secondary form; year_offset is applied once
// (see the year_offset comment below).
const resolve_params_contribution = (params) => {
  if (!params || typeof params !== 'object') return []

  let nfl_week_ids = normalize_array(params.nfl_week_id).filter(
    (id) =>
      typeof id === 'string' && parse_nfl_week_identifier({ identifier: id })
  )

  if (!nfl_week_ids.length) {
    nfl_week_ids = expand_year_seas_type({
      year: params.year,
      seas_type: params.seas_type
    })
  }

  if (!nfl_week_ids.length) return []

  // year_offset is applied exactly once. resolve_nfl_week_params
  // (get-data-view-results.mjs) bakes the offset into an explicit nfl_week_id
  // list upstream and sets year_offset_applied_to_nfl_week_id; re-applying it
  // here would double-shift the source window to base + 2*offset while the
  // outer join shifts by only 1*offset, silently dropping the bottom
  // offset-cohort of base years. Apply the offset only when it has not already
  // been baked into this nfl_week_id list (year-derived and internally-built
  // week lists arrive unshifted and still need it).
  if (
    params.year_offset != null &&
    !params.year_offset_applied_to_nfl_week_id
  ) {
    nfl_week_ids = apply_year_offset_to_nfl_weeks({
      nfl_weeks: nfl_week_ids,
      year_offset: params.year_offset
    })
  }

  return nfl_week_ids
}

// columns: array of strings or { column_id, params } objects
// where:   array of { column_id, operator, value, params }
// view_params: top-level params passed at the request layer (rare)
//
// Returns an empty list when no source supplies year / nfl_week_id / seas_type.
// In that case, downstream apply_scope_to_query no-ops, preserving the historical
// "no scope predicate" behavior for views that never declare a time scope. The
// REG-only default still applies whenever any source does supply year (e.g.
// year split, column.params.year, where-clause year): the default seas_type
// fills in inside resolve_params_contribution.
export default function resolve_view_scope({
  prefix_columns = [],
  columns = [],
  where = [],
  view_params = null
}) {
  const all = new Set()

  const consume = (params) => {
    const contribution = resolve_params_contribution(params)
    for (const id of contribution) all.add(id)
  }

  const consume_item = (item) => {
    if (typeof item === 'object' && item && item.params) consume(item.params)
  }

  prefix_columns.forEach(consume_item)
  columns.forEach(consume_item)
  where.forEach((clause) => clause && clause.params && consume(clause.params))
  if (view_params) consume(view_params)

  return [...all].sort()
}

export { DEFAULT_SEAS_TYPE, resolve_params_contribution }
