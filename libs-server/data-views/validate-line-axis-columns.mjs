import { resolve_line_axis_sources } from '#libs-server/data-views/line-axis-sources.mjs'

// Runtime check, run beside validate_row_grain_compatibility and
// validate_week_requirement: under a line row axis, every ladder column must
// measure the SAME QUANTITY.
//
// THE DEFECT THIS REFUSES. The axis rows are keyed on the raw line value, so
// two ladder columns on different market types get juxtaposed on a shared
// numeral. A row labelled 199.5 would put "199.5 passing yards" beside "199.5
// rushing yards" as though they were one bet at one price. They are unrelated
// quantities that happen to share a number, the way a price in dollars and a
// temperature in degrees both read 72.
//
// A partial render is the wrong answer here for the same reason the whole task
// exists: the collapse this axis undoes was wrong AND plausible-looking, and a
// sparse two-quantity table is equally plausible-looking. Refusing names both
// columns and says to split them into two views, which costs the caller nothing
// -- each ladder is what they wanted to look at anyway.
//
// WHAT IS ALLOWED, and it is the point of the feature. Two ladder columns on
// ONE market type differing by book, time type or side. FanDuel and DraftKings
// alt passing yards share a row at 199.5 and that row compares like with like,
// which is line shopping. Measured on 2024 GAME_ALT_PASSING_YARDS / CLOSE /
// OVER the two books overlap heavily at FanDuel's grid points (199.5 carries
// 444 FanDuel selections against 558 DraftKings).
//
// RUNG-ORDINAL ALIGNMENT was considered as a way to admit different quantities
// -- pair the first rung with the first, the second with the second -- and
// rejected for the same reason: the first rung of two different quantities is
// no more comparable than the same numeral is.
//
// Only columns naming an EXPLICIT market_type reach here, because those are the
// only ones that contribute rungs; see line-axis-sources.mjs for why a column
// on its single-line default is correctly absent from the domain.

/**
 * @param {object} args
 * @param {string[]} [args.row_axes]
 * @param {Array<string|{column_id: string, params?: object}>} [args.columns]
 * @param {Array<string|{column_id: string, params?: object}>} [args.prefix_columns]
 * @param {object} args.defs - column definition registry
 * @returns {string[]} error messages, empty on success
 */
export default function validate_line_axis_columns({
  row_axes = [],
  columns = [],
  prefix_columns = [],
  defs
}) {
  if (!row_axes.includes('line')) return []

  const sources = resolve_line_axis_sources({
    columns,
    prefix_columns,
    data_views_column_definitions: defs
  })

  const market_types = new Set()
  for (const source of sources) {
    for (const market_type of source.market_type) market_types.add(market_type)
  }

  if (market_types.size <= 1) return []

  const named_columns = [...prefix_columns, ...columns]
    .filter((item) => item && typeof item === 'object')
    .filter((item) => defs[item.column_id]?.is_player_game_prop)
    .filter((item) => {
      const market_type = item.params?.market_type
      return Array.isArray(market_type)
        ? market_type.length
        : Boolean(market_type)
    })
    .map((item) => item.column_id)

  return [
    `LineAxisQuantityMismatch: a line row axis keys rows on the line VALUE, so every ` +
      `column on it must measure the same quantity, but these market types were requested ` +
      `together: ${[...market_types].sort().join(', ')} ` +
      `(columns: ${[...new Set(named_columns)].join(', ')}). ` +
      `Split them into one view per market type.`
  ]
}
