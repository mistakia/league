// Runtime check, run beside validate_row_grain_compatibility: a column whose
// source rows are keyed by WEEK must have a week to resolve.
//
// THE DEFECT THIS REPLACES. `apply_projected_join` fell back to
// `params.week || 0` when a week-scoped column was requested with no week. Week
// 0 was the season key while every projection period shared one table, so the
// column returned a SEASON value under a week header. After the 2026-08-29
// period split, week 0 is a week the narrowed tables cannot hold, so the join
// matched nothing and the column read BLANK. Wrong-period and silently-empty,
// same expression, and neither raises anything.
//
// WHAT COUNTS AS RESOLVABLE, and why this is not a row-axes question. Three
// separate things supply a week, and a check that sees only one of them refuses
// requests that are fine:
//
//   1. an explicit `week` param on the column
//   2. an `nfl_week_id` / `single_nfl_week_id` param, which decomposes to one
//   3. a `week` ROW AXIS, which gives the join a week_reference per row
//
// (1) is the case that makes the obvious design wrong. Declaring the sources
// `grain: 'player_year_week'` and letting source-attach refuse an unmatched
// cell identity was the inherited plan, and it refuses a flat "every player's
// week 2 projection" table -- an explicit week param under a player row, with
// no row axis at all. That shape ships, and
// test/data-view-queries/create-a-query-for-week-projected-stats.json is it.
// Grain cannot see params, so grain is the wrong instrument for this question.
//
// The SEASON and REST-OF-SEASON periods are unaffected and must stay that way:
// their tables carry no week column, they declare no week requirement, and they
// remain resolvable under every request shape.

const item_column_id = (item) => {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') return item.column_id
  return null
}

const has_value = (value) => {
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value)) return value.some((entry) => has_value(entry))
  return true
}

/**
 * Whether a week is available to a column under this request. Exported so the
 * SQL-validity gate skips the shapes the boundary refuses, rather than
 * EXPLAINing a request that is a 400 and reporting the refusal as a finding.
 */
export const week_is_resolvable = ({ params = {}, row_axes = [] }) =>
  row_axes.includes('week') ||
  has_value(params.week) ||
  has_value(params.nfl_week_id) ||
  has_value(params.single_nfl_week_id)

const check_item = ({ item, field, row_axes, defs, errors }) => {
  const column_id = item_column_id(item)
  if (!column_id) return
  const def = defs[column_id]
  if (!def?.source?.requires_week) return
  const params = (typeof item === 'object' && item?.params) || {}
  if (week_is_resolvable({ params, row_axes })) return
  errors.push(
    `ColumnWeekRequired: column '${column_id}' (${field}) reads week-keyed ` +
      `rows and the request resolves no week. Set a week param, an ` +
      `nfl_week_id, or a week row axis.`
  )
}

/**
 * Returns an array of message strings (empty on success), the same shape
 * table_state_validator's failure branch produces, so the caller merges them
 * into one thrown error.
 */
export default function validate_week_requirement({
  row_axes = [],
  prefix_columns = [],
  columns = [],
  where = [],
  defs
}) {
  const errors = []
  const check = (items, field_name) =>
    items.forEach((item, index) =>
      check_item({
        item,
        field: `${field_name}[${index}]`,
        row_axes,
        defs,
        errors
      })
    )
  check(prefix_columns, 'prefix_columns')
  check(columns, 'columns')
  check(where, 'where')
  return errors
}
