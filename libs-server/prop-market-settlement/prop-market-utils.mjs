/**
 * Consolidated utility functions for prop market settlement
 * Combines shared utilities and market processor utilities
 */

import debug from 'debug'
import db from '#db'

const log = debug('prop-market-utils')

/**
 * Parse score value with validation
 * @param {*} value - Score value to parse
 * @returns {number} Parsed score
 * @throws {Error} If score is not a valid number
 */
const parse_score = (value) => {
  if (value === null || value === undefined) {
    return null
  }
  const num = Number(value)
  if (Number.isNaN(num)) {
    throw new Error(`Invalid score value: ${value}`)
  }
  return num
}

/**
 * Parse the line a selection is graded against
 * @param {*} value - Line value carried by the selection row
 * @returns {number} Parsed line
 * @throws {Error} If the line is missing or not a number
 */
const parse_selection_metric_line = (value) => {
  if (value === null || value === undefined || value === '') {
    throw new Error('Missing selection metric line')
  }
  const line = Number(value)
  if (Number.isNaN(line)) {
    throw new Error(`Invalid selection metric line: ${value}`)
  }
  return line
}

/**
 * Calculate metric value by summing specified columns or using calculation_type
 * @param {object} data_item - Data object containing metric columns or game data
 * @param {object} mapping - Market mapping with metric_columns or calculation_type
 * @returns {number|null} Total metric value, or null when the game has no scores yet
 * @throws {Error} If the mapping names no metric, or a metric column holds a non-numeric value
 */
export const calculate_metric_value = (data_item, mapping) => {
  // Handle calculation_type for NFL_GAMES handler
  if (mapping.calculation_type) {
    const home_score = parse_score(data_item.home_score)
    const away_score = parse_score(data_item.away_score)

    // Return null if scores are missing (game not finished)
    if (home_score === null || away_score === null) {
      return null
    }

    // Moneyline (winner_determination) has no case here: the NFL_GAMES handler
    // grades it inline from the two scores and calls this only for the two
    // calculation types below.
    switch (mapping.calculation_type) {
      case 'total_points':
        return home_score + away_score
      case 'point_differential_vs_spread':
        // Returns from home team perspective (caller adjusts for team)
        return home_score - away_score
      default:
        throw new Error(`Unknown calculation_type: ${mapping.calculation_type}`)
    }
  }

  if (!mapping.metric_columns || mapping.metric_columns.length === 0) {
    throw new Error(
      `Mapping for handler ${mapping.handler} names neither a calculation_type nor metric_columns, so there is no metric to settle against`
    )
  }

  let total = 0
  for (const column of mapping.metric_columns) {
    const value = data_item[column]
    if (value === null || value === undefined) {
      continue
    }
    const numeric_value = Number(value)
    if (Number.isNaN(numeric_value)) {
      throw new Error(`Non-numeric value in metric column ${column}: ${value}`)
    }
    total += numeric_value
  }

  return total
}

/**
 * Determine selection result based on type and line
 * @param {object} params - Parameters object
 * @param {number} params.metric_value - Calculated metric value
 * @param {string} params.selection_type - OVER/UNDER/YES/NO or team_id for spreads
 * @param {number} params.selection_metric_line - Line to compare against
 * @param {object} params.mapping - Market mapping configuration
 * @returns {string} 'WON', 'LOST', or 'PUSH'
 * @throws {Error} If there is no metric value, no usable line, or an unknown selection type
 */
export const determine_selection_result = ({
  metric_value,
  selection_type,
  selection_metric_line,
  mapping
}) => {
  if (metric_value === null || metric_value === undefined) {
    throw new Error(
      `No metric value to settle selection type ${selection_type} against`
    )
  }

  const type = selection_type ? selection_type.toLowerCase() : null

  // Both reduce to the same scored/did-not-score test: the gamelog handler sums
  // the player's touchdown columns, and the plays handler reduces the game's
  // first touchdown to 1 or 0 for the selected player.
  if (
    mapping.special_logic === 'anytime_touchdown' ||
    mapping.special_logic === 'first_touchdown_scorer'
  ) {
    if (type === 'yes') {
      return metric_value > 0 ? 'WON' : 'LOST'
    } else if (type === 'no') {
      return metric_value === 0 ? 'WON' : 'LOST'
    }
  }

  // Two or more touchdowns logic
  if (mapping.special_logic === 'two_plus_touchdowns') {
    if (type === 'yes') {
      return metric_value >= 2 ? 'WON' : 'LOST'
    } else if (type === 'no') {
      return metric_value < 2 ? 'WON' : 'LOST'
    }
  }

  // Handle spread markets (point_differential_vs_spread)
  // metric_value is point differential from selected team's perspective
  // line is the spread (negative means favorite, positive means underdog)
  // Team covers if: point_differential + spread > 0
  if (mapping.calculation_type === 'point_differential_vs_spread') {
    const adjusted_margin =
      metric_value + parse_selection_metric_line(selection_metric_line)
    if (adjusted_margin === 0) {
      return 'PUSH'
    }
    return adjusted_margin > 0 ? 'WON' : 'LOST'
  }

  // Standard over/under logic
  // Note: NFL scores are integers and lines are stored as decimals (e.g., 44.0, 44.5)
  // Integer comparison with decimal works correctly in JavaScript (44 === 44.0 is true)
  if (type === 'over' || type === 'under') {
    const line = parse_selection_metric_line(selection_metric_line)
    if (metric_value === line) {
      return 'PUSH'
    }
    if (type === 'over') {
      return metric_value > line ? 'WON' : 'LOST'
    }
    return metric_value < line ? 'WON' : 'LOST'
  }

  throw new Error(`Unknown selection type: ${selection_type}`)
}

/**
 * Group data by game ID (esbid)
 * @param {object[]} data - Array of data objects with esbid property
 * @returns {object} Data grouped by esbid
 */
export const group_by_game = (data) => {
  const grouped = {}
  for (const item of data) {
    const esbid = item.esbid
    if (!grouped[esbid]) {
      grouped[esbid] = []
    }
    grouped[esbid].push(item)
  }
  return grouped
}

/**
 * Create the settlement result for one selection row
 *
 * A selection's OPEN and CLOSE rows can carry different lines, so each is
 * fetched and graded on its own and the result is stamped with the time_type of
 * the row it came from.
 *
 * @param {object} params - Named parameters
 * @param {object} params.market - Market object for one selection row, carrying its time_type
 * @param {number} params.metric_value - Calculated metric value
 * @param {string} params.selection_result - WON/LOST/PUSH result
 * @param {string} params.handler_type - Handler type identifier
 * @param {string} params.error - Error message if any
 * @returns {object} Result object for the row's time_type
 */
export const create_selection_result = ({
  market,
  metric_value,
  selection_result,
  handler_type,
  error = null
}) => ({
  esbid: market.esbid,
  market_type: market.market_type,
  selection_pid: market.selection_pid,
  selection_type: market.selection_type,
  selection_metric_line: market.selection_metric_line,
  source_id: market.source_id,
  source_market_id: market.source_market_id,
  source_selection_id: market.source_selection_id,
  time_type: market.time_type,
  metric_value,
  selection_result,
  handler_type,
  error
})

/**
 * Format duration in human-readable format
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export const format_duration = (ms) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

/**
 * Validate games have complete score data
 *
 * @param {Array<string>} esbids - Game IDs to validate
 * @returns {Array<string>} Valid game IDs with complete data
 */
export const validate_games_with_data = async (esbids) => {
  if (!esbids || esbids.length === 0) return []

  log(`Validating ${esbids.length} games for complete data`)

  const valid_games = await db('nfl_games')
    .select('esbid')
    .whereIn('esbid', esbids)
    .whereNotNull('home_score')
    .whereNotNull('away_score')
    .where('status', 'like', 'FINAL%')

  const valid_esbids = valid_games.map((row) => row.esbid)

  log(`Found ${valid_esbids.length} games with complete data`)

  return valid_esbids
}

/**
 * Fetch settleable selection rows for specified games
 *
 * One row per selection per time_type, each carrying the line that row is
 * graded against — the OPEN and CLOSE lines of a selection routinely differ, so
 * a CLOSE row settled against its OPEN line grades the wrong bet.
 *
 * @param {object} params - Named parameters
 * @param {Array<string>} params.esbids - Game IDs to fetch markets for
 * @param {number} params.year - Season year
 * @param {boolean} params.missing_only - Only fetch selections with no result yet
 * @param {Array<string>} params.supported_market_types - Supported market types
 * @returns {object[]} Selection rows, one per time_type
 */
export const fetch_markets_for_games = async ({
  esbids,
  year,
  missing_only = false,
  supported_market_types
}) => {
  if (!esbids || esbids.length === 0) return []

  log(`Fetching selections for ${esbids.length} games`)

  const markets = await db('prop_market_selections_index')
    .select(
      'prop_markets_index.esbid',
      'prop_markets_index.market_type',
      'prop_market_selections_index.selection_pid',
      'prop_market_selections_index.selection_metric_line',
      'prop_market_selections_index.selection_type',
      'prop_market_selections_index.source_id',
      'prop_market_selections_index.source_market_id',
      'prop_market_selections_index.source_selection_id',
      'prop_market_selections_index.time_type'
    )
    // prop_markets_index is keyed by time_type too, so a join without it pairs
    // every selection row with both market rows. That is not only a duplicate:
    // the two rows of a market can carry different esbid, market_type and
    // season_year, so the extra pairing grades the selection against another
    // game. Each selection row belongs to its own snapshot's market row.
    .join('prop_markets_index', function () {
      this.on(
        'prop_markets_index.source_id',
        '=',
        'prop_market_selections_index.source_id'
      )
        .andOn(
          'prop_markets_index.source_market_id',
          '=',
          'prop_market_selections_index.source_market_id'
        )
        .andOn(
          'prop_markets_index.time_type',
          '=',
          'prop_market_selections_index.time_type'
        )
    })
    .whereIn('prop_markets_index.esbid', esbids)
    .andWhere('prop_markets_index.season_year', year)
    .modify((qb) => {
      if (supported_market_types && supported_market_types.length > 0) {
        qb.whereIn('prop_markets_index.market_type', supported_market_types)
      }
      if (missing_only) {
        // Results are written at selection grain, so the market-grain
        // is_market_settled flag would skip selections still unsettled under a
        // market already marked settled.
        qb.whereNull('prop_market_selections_index.selection_result')
      }
    })

  log(`Found ${markets.length} selections`)

  return markets
}
