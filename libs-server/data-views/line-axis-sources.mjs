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

import { bookmaker_constants } from '#libs-shared'

/**
 * Does this market post many selections per player-game?
 *
 * The question the line axis turns on, and deliberately NOT the same question
 * as is_player_game_prop, which is true for a standard game market too. A
 * standard market posts exactly one selection per player-game -- measured at
 * 1.0 for GAME_PASSING_YARDS across 2024 -- so it defines no rungs and must not
 * be correlated on one.
 *
 * The set lives in bookmaker-constants because the client asks the same
 * question to decide whether to OFFER the axis; see the comment there.
 *
 * @param {string} market_type
 * @returns {boolean}
 */
export const is_ladder_market_type = (market_type) =>
  bookmaker_constants.ladder_market_types.has(market_type)

/**
 * Is the line row axis active for this request?
 *
 * Request-level, for the two bridge-chain sites in get-data-view-results, which
 * run before any identity reference is mirrored. A COLUMN must not ask this --
 * see resolve_line_scope.
 *
 * @param {string[]} [row_axes]
 * @returns {boolean}
 */
export const is_line_axis_active = (row_axes = []) => row_axes.includes('line')

/**
 * Does this cell have a rung to correlate against?
 *
 * The column-facing question, and deliberately NOT `row_axes.includes('line')`.
 * A column declared at the base `player` grain is handed an EMPTY row_axes even
 * under a line-axis request, because group_tables_by_supported_row_axes
 * intersects the request axes with those of the identity its source.grain
 * names -- so row_axes answers "no line axis" on exactly the betting columns
 * that need to know. line_reference is the identity-derived reference itself
 * and exists exactly when the axis is live, which is the same reasoning
 * week-scoped-cte.mjs records for week_split.
 *
 * @param {object} args
 * @param {object} [args.data_view_options] - carries the identity references
 * @returns {{line_split: boolean, line_reference: string|null}}
 */
export const resolve_line_scope = ({ data_view_options } = {}) => {
  const line_reference = data_view_options?.line_reference || null
  return { line_split: Boolean(line_reference), line_reference }
}

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
    // LADDER MARKETS ONLY. A column naming an explicit but single-line market
    // is a legitimate neighbour of a ladder -- the reported view carries four
    // of them -- and it contributes no rungs, so admitting it here both
    // polluted the domain with its own line and made the same-quantity rule
    // count it as a second quantity, refusing the view outright.
    const market_type = as_array(params.market_type).filter(
      is_ladder_market_type
    )
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
