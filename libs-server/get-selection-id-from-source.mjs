import db from '#db'
import { format_standard_selection_id } from '#libs-shared'

/**
 * Looks up selection details from database and formats using standard format.
 * Used by wager import scripts (DraftKings, Fanatics) that store source IDs.
 *
 * @param {Object} params
 * @param {string} params.source_id - Book identifier (e.g., 'DRAFTKINGS', 'FANATICS')
 * @param {string} params.source_market_id - Book's market ID
 * @param {string} params.source_selection_id - Book's selection ID
 * @returns {Promise<string>} Standard selection ID or UNKNOWN format if not found
 */
const get_selection_id_from_source = async ({
  source_id,
  source_market_id,
  source_selection_id
}) => {
  const prop_market_selection_row = await db('prop_market_selections_index')
    .join('prop_markets_index', function () {
      this.on(
        'prop_market_selections_index.source_market_id',
        '=',
        'prop_markets_index.source_market_id'
      )
      this.andOn(
        'prop_market_selections_index.source_id',
        '=',
        'prop_markets_index.source_id'
      )
    })
    .where(
      'prop_market_selections_index.source_selection_id',
      source_selection_id
    )
    .where('prop_market_selections_index.source_id', source_id)
    .where('prop_market_selections_index.source_market_id', source_market_id)
    .select(
      'prop_market_selections_index.selection_pid',
      'prop_market_selections_index.selection_metric_line',
      'prop_market_selections_index.selection_type',
      'prop_market_selections_index.nfl_team',
      'prop_markets_index.market_type',
      'prop_markets_index.esbid',
      'prop_markets_index.year'
    )
    .first()

  if (!prop_market_selection_row) {
    return `UNKNOWN|SOURCE:${source_id}|RAW:source_market_id=${source_market_id},source_selection_id=${source_selection_id}`
  }

  const {
    year,
    esbid,
    market_type,
    selection_pid,
    selection_type,
    selection_metric_line,
    nfl_team
  } = prop_market_selection_row

  // Use format_standard_selection_id with safe=true for consistent error handling
  // It will return UNKNOWN format if formatting fails (e.g., invalid team)
  if (esbid) {
    return format_standard_selection_id({
      esbid,
      market_type,
      pid: selection_pid,
      team: nfl_team,
      selection_type,
      line: selection_metric_line,
      safe: true,
      source_id,
      raw_data: {
        source_market_id,
        source_selection_id
      }
    })
  } else if (year) {
    return format_standard_selection_id({
      year,
      seas_type: 'REG',
      market_type,
      pid: selection_pid,
      team: nfl_team,
      selection_type,
      line: selection_metric_line,
      safe: true,
      source_id,
      raw_data: {
        source_market_id,
        source_selection_id
      }
    })
  }

  // Neither esbid nor year available
  return `UNKNOWN|SOURCE:${source_id}|RAW:source_market_id=${source_market_id},source_selection_id=${source_selection_id},market_type=${market_type}`
}

export default get_selection_id_from_source
