// Which betting markets define the rungs of an active line row axis.
//
// ONE RESOLUTION, because the line axis has the same three-way split the week
// axis has: the CTE that holds the rungs, the join that correlates them, and
// (later) the markets CTE that reads a value at each rung all have to agree on
// which markets are in play. week-scoped-cte.mjs exists because those three
// drifted apart once already and each way they drift is silent. This module is
// the same fix applied before the drift rather than after.
//
// EXPLICIT market_type ONLY, deliberately. A betting column that names no
// market_type takes the column family's own default, which is a single-line
// market -- one selection per player-game, measured at exactly 1.0 for
// GAME_PASSING_YARDS across 2024. Such a column contributes no rungs, so
// leaving it out of the domain is correct rather than a gap, and it means this
// module never has to restate the defaults that live in get_default_params.
// Restating them is the drift this avoids.

/**
 * Is the line row axis active for this request?
 *
 * @param {string[]} [row_axes]
 * @returns {boolean}
 */
export const is_line_axis_active = (row_axes = []) => row_axes.includes('line')

const as_array = (value) => {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * The market selectors whose selections become rows under a line axis.
 *
 * Read off the REQUEST rather than off the emitted SQL: the rung domain has to
 * exist before any column's CTE is built, because the axis is what those CTEs
 * will be correlated against.
 *
 * @param {object} args
 * @param {Array<string|{column_id: string, params?: object}>} [args.columns] - request columns
 * @param {Array<string|{column_id: string, params?: object}>} [args.prefix_columns]
 * @param {object} args.data_views_column_definitions
 * @returns {Array<{market_type: string[], source_id: string[], time_type: string[], selection_type: string[]}>}
 */
export const resolve_line_axis_sources = ({
  columns = [],
  prefix_columns = [],
  data_views_column_definitions
}) => {
  const sources = []
  const seen = new Set()

  for (const item of [...prefix_columns, ...columns]) {
    if (!item || typeof item !== 'object') continue
    const definition = data_views_column_definitions[item.column_id]
    // The marker is declared on the column definition rather than inferred
    // from the params, so a betting column that stops carrying a market_type
    // does not silently drop out of the domain.
    if (!definition?.is_player_game_prop) continue

    const params = item.params || {}
    const market_type = as_array(params.market_type)
    if (!market_type.length) continue

    const source = {
      market_type,
      source_id: as_array(params.source_id),
      time_type: as_array(params.time_type),
      selection_type: as_array(params.selection_type)
    }

    // Two columns differing only in which VALUE they read (line, odds, implied
    // probability) select the same selections and must contribute one domain
    // entry, or the rung set is unioned with itself.
    const key = JSON.stringify(source)
    if (seen.has(key)) continue
    seen.add(key)
    sources.push(source)
  }

  return sources
}
