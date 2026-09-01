import resolve_single_nfl_week_id, {
  resolve_nfl_week_ids
} from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'

// One resolution of "which weeks does this CTE hold, and does the cell have a
// week to correlate on", shared by every part of a week-scoped column.
//
// THE CLASS THIS EXISTS TO CLOSE. A fact keyed by (subject, year, week) reaches
// a cell that may or may not carry a week axis, and three decisions have to
// agree: how many weeks the CTE spans, whether the JOIN correlates on week, and
// what the table alias hashes. When they are written separately they drift, and
// every way they drift is silent:
//
//   - CTE pinned to one week, cell split by week -> that week's value is
//     broadcast onto every week row. Shipped for the whole life of the player
//     game-prop columns and player_dfs_ownership_percentage; reported against
//     2024 weeks 1-2, where every player's prop line was identical across the
//     two weeks (/u/47a2d459080c3bc61eb4e850dba1164e).
//   - CTE spanning N weeks, JOIN not correlated -> the week cell fans out into
//     one row per week in the CTE.
//   - Alias hashing fewer weeks than the CTE holds -> two columns differing
//     only in their week list collapse onto one join group, and one of them
//     renders the other's data.
//
// The week list is resolved here and nowhere else, so those three cannot
// disagree.
//
// WHY week_split COMES FROM week_reference. The `row_axes` handed to a column
// is intersected with the row axes of the identity its `source.grain` names, so
// a column declared at the base `player` grain is handed an EMPTY list even
// under a week-axis request. week_reference is the identity-derived reference
// itself: it exists exactly when the cell has a week to correlate against, in
// both the with-builder and the join, which is the question being asked.

/**
 * @param {object} args
 * @param {object} [args.params] - column params
 * @param {object} [args.data_view_options] - carries the identity references
 * @returns {{week_split: boolean, nfl_week_ids: string[]}}
 */
export const resolve_week_scope = ({ params = {}, data_view_options } = {}) => {
  const week_split = Boolean(data_view_options?.week_reference)

  if (week_split) {
    return { week_split, nfl_week_ids: resolve_nfl_week_ids({ params }) }
  }

  // No week axis: the cell is one flat row per subject, so a CTE spanning
  // several weeks would fan it out with nothing to select between them. Collapse
  // to the single week the column has always resolved -- first entry, or the
  // scalar resolver's fallback chain when the request names none.
  const single_nfl_week_id = resolve_single_nfl_week_id({ params })
  return {
    week_split,
    nfl_week_ids: single_nfl_week_id ? [single_nfl_week_id] : []
  }
}

/**
 * The week component of a table alias.
 *
 * Deliberately hashes the FULL requested week list even in the pinned case,
 * where the CTE holds only the first entry. A table alias is a join-group key
 * WITHIN one query, and row_axes is a property of the request rather than of a
 * column, so no two columns in a query can disagree about week_split -- which
 * means including it would buy nothing. Hashing the full list makes the alias
 * strictly finer than the CTE contents: two pinned columns naming different
 * week lists get two identical CTEs under two aliases, which costs a join and
 * cannot collapse. The reverse error is the one that renders wrong data.
 *
 * @param {object} args
 * @param {object} [args.params]
 * @returns {string}
 */
export const week_scope_alias_key = ({ params = {} } = {}) =>
  resolve_nfl_week_ids({ params }).join('_')

/**
 * Correlate a week-scoped CTE to the cell's year and week.
 *
 * Call from inside a join callback. Emits nothing when the cell carries no week
 * axis, which is the pinned case the CTE was narrowed for.
 *
 * The YEAR predicate is not optional cover for the week one: a week list names
 * weeks, not years, and a view that sets no year filter spans the whole
 * year_range -- so week 1 of one season would otherwise match week 1 of every
 * other season in scope.
 *
 * @param {object} args
 * @param {object} args.builder - knex join builder (`this` inside the callback)
 * @param {object} args.db - knex instance
 * @param {string} args.cte_name
 * @param {object} args.data_view_options
 * @param {string} [args.year_column]
 * @param {string} [args.week_column]
 */
export const correlate_week_scoped_cte = ({
  builder,
  db,
  cte_name,
  data_view_options,
  year_column = 'year',
  week_column = 'week'
}) => {
  const { week_split } = resolve_week_scope({ data_view_options })
  if (!week_split) return

  const { year_reference, week_reference } = data_view_options
  builder.andOn(db.raw(`${cte_name}.${year_column} = ${year_reference}`))
  builder.andOn(db.raw(`${cte_name}.${week_column} = ${week_reference}`))
}
