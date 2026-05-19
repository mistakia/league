// Shared scope-emission helper. Every helper that filters nfl_games,
// nfl_plays, or player_gamelogs by year/seas_type/nfl_week_id should call
// this exactly once instead of emitting predicates by hand.
//
// Inputs:
//   - query: a knex query builder
//   - table_name: the table to apply predicates against (carries year and,
//     when present, seas_type and nfl_week_id columns)
//   - query_context: the canonical scope owner. Reads query_context.nfl_week_ids
//   - column_params: per-column override params. When set, narrows the view
//     scope to the column's own nfl_week_id (or year+seas_type expansion).
//
// Emission shape mirrors apply_play_by_play_column_params_to_query's
// nfl_week_id branch:
//   - year IN (years)          engages partition pruning + composite indexes
//   - seas_type IN (seas_types) engages (year, seas_type, ...) composite
//   - nfl_week_id IN (effective) only when narrower than (year x seas_type)
//     full coverage (is_full_year_seas_type_coverage short-circuit)
//
// has_seas_type / has_nfl_week_id flags let callers opt out for tables that
// only carry year (e.g. legacy aggregates).

import {
  decompose_nfl_weeks,
  is_full_year_seas_type_coverage,
  parse_nfl_week_identifier
} from '#libs-shared/nfl-week-identifier.mjs'
import { resolve_params_contribution } from './resolve-view-scope.mjs'

const sort_deterministic = (ids) => [...ids].sort()

const normalize_array = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])

const has_explicit_time_scope = (params) =>
  Boolean(
    params &&
      (params.nfl_week_id ||
        params.year ||
        params.seas_type ||
        params.year_offset)
  )

// Compute the effective nfl_week_id list for an emission site.
//
// Resolution rules:
//   1. No column override → view scope verbatim.
//   2. Column declared nfl_week_id → use the column list, intersected with
//      view scope so a column can narrow but not widen the view.
//   3. Column declared year (with or without seas_type / year_offset) → use
//      the column's own year × seas_type expansion, intersected with view.
//   4. Column declared seas_type only (no year / nfl_week_id / year_offset)
//      → take the view's year set and re-expand against the column's
//      seas_type. Lets a column declare "POST only" without restating year.
//   5. No relevant column params → view scope.
//
// Always returns a lexicographically sorted list so downstream year /
// nfl_week_id IN-list output is stable across param-order variation.
export const compute_effective_scope = ({
  query_context,
  column_params = null
}) => {
  const view_scope = (query_context && query_context.nfl_week_ids) || []
  if (!column_params || !has_explicit_time_scope(column_params)) {
    return sort_deterministic(view_scope)
  }

  // Rule 4: seas_type without year → re-expand view's years onto the column's
  // seas_type. Detect by absence of year / nfl_week_id / year_offset.
  const has_year_like =
    column_params.nfl_week_id || column_params.year || column_params.year_offset
  if (!has_year_like && normalize_array(column_params.seas_type).length) {
    if (!view_scope.length) return []
    const allowed = new Set(normalize_array(column_params.seas_type))
    // Re-expand the view's (year × allowed-seas_type) cross product, not
    // just filter -- the view's nfl_week_ids may not contain weeks for the
    // requested seas_type (e.g. view scope is REG-only, column wants POST).
    const view_years = new Set()
    for (const id of view_scope) {
      const parsed = parse_nfl_week_identifier({ identifier: id })
      if (parsed) view_years.add(parsed.year)
    }
    const re_expanded = resolve_params_contribution({
      year: [...view_years],
      seas_type: [...allowed]
    })
    return sort_deterministic(re_expanded)
  }

  const column_contribution = resolve_params_contribution(column_params)
  if (!column_contribution.length) return sort_deterministic(view_scope)
  if (!view_scope.length) return sort_deterministic(column_contribution)
  const view_set = new Set(view_scope)
  return sort_deterministic(column_contribution.filter((x) => view_set.has(x)))
}

export const apply_scope_to_query = ({
  query,
  table_name,
  query_context,
  column_params = null,
  has_seas_type = true,
  has_nfl_week_id = true
}) => {
  const effective = compute_effective_scope({ query_context, column_params })
  if (!effective.length) return

  const { years, seas_types } = decompose_nfl_weeks({ nfl_weeks: effective })
  // Sort decomposed components for deterministic SQL output regardless of the
  // upstream nfl_week_id list ordering.
  const sorted_years = [...years].sort((a, b) => a - b)
  const sorted_seas_types = [...seas_types].sort()

  // Emission order mirrors the legacy apply_play_by_play_column_params_to_query
  // nfl_week_id branch: nfl_week_id IN (narrow), then seas_type, then year.
  // Keeps fixture diffs minimal across the migration.
  if (
    has_nfl_week_id &&
    !is_full_year_seas_type_coverage({ nfl_weeks: effective })
  ) {
    query.whereIn(`${table_name}.nfl_week_id`, effective)
  }
  if (has_seas_type && sorted_seas_types.length) {
    query.whereIn(`${table_name}.seas_type`, sorted_seas_types)
  }
  if (sorted_years.length) {
    query.whereIn(`${table_name}.year`, sorted_years)
  }
}

export default apply_scope_to_query
