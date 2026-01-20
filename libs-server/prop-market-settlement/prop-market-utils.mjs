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
 * Calculate metric value by summing specified columns or using calculation_type
 * @param {Object} data_item - Data object containing metric columns or game data
 * @param {Object} mapping - Market mapping with metric_columns or calculation_type
 * @returns {number} Total metric value
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

    switch (mapping.calculation_type) {
      case 'total_points':
        return home_score + away_score
      case 'point_differential_vs_spread':
        // Returns from home team perspective (caller adjusts for team)
        return home_score - away_score
      case 'winner_determination':
        // No metric value needed for moneyline
        return null
      default:
        return null
    }
  }

  if (!mapping.metric_columns || mapping.metric_columns.length === 0) {
    return null
  }

  let total = 0
  for (const column of mapping.metric_columns) {
    const value = data_item[column]
    if (value !== null && value !== undefined) {
      total += Number(value) || 0
    }
  }

  return total
}

/**
 * Determine selection result based on type and line
 * @param {Object} params - Parameters object
 * @param {number} params.metric_value - Calculated metric value
 * @param {string} params.selection_type - OVER/UNDER/YES/NO or team_id for spreads
 * @param {number} params.selection_metric_line - Line to compare against
 * @param {Object} params.mapping - Market mapping configuration
 * @returns {string} 'WON', 'LOST', or 'PUSH'
 */
export const determine_selection_result = ({
  metric_value,
  selection_type,
  selection_metric_line,
  mapping
}) => {
  if (metric_value === null || metric_value === undefined) {
    return null
  }

  const line = Number(selection_metric_line) || 0
  const type = selection_type ? selection_type.toLowerCase() : null

  // Handle special logic cases
  if (mapping.special_logic === 'anytime_touchdown') {
    if (type === 'yes') {
      return metric_value > 0 ? 'WON' : 'LOST'
    } else if (type === 'no') {
      return metric_value === 0 ? 'WON' : 'LOST'
    }
  }

  // First touchdown scorer logic
  if (mapping.special_logic === 'first_touchdown_scorer') {
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
    const adjusted_margin = metric_value + line
    if (adjusted_margin === 0) {
      return 'PUSH'
    }
    return adjusted_margin > 0 ? 'WON' : 'LOST'
  }

  // Standard over/under logic
  // Note: NFL scores are integers and lines are stored as decimals (e.g., 44.0, 44.5)
  // Integer comparison with decimal works correctly in JavaScript (44 === 44.0 is true)
  if (type === 'over' || type === 'under') {
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
 * @param {Array} data - Array of data objects with esbid property
 * @returns {Object} Data grouped by esbid
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
 * Create both OPEN and CLOSE result objects for a single market calculation
 * @param {Object} params - Named parameters
 * @param {Object} params.market - Market object (should not have time_type set)
 * @param {number} params.metric_value - Calculated metric value
 * @param {string} params.selection_result - WON/LOST result
 * @param {string} params.handler_type - Handler type identifier
 * @param {string} params.error - Error message if any
 * @returns {Array<Object>} Array with OPEN and CLOSE result objects
 */
export const create_dual_result_objects = ({
  market,
  metric_value,
  selection_result,
  handler_type,
  error = null
}) => {
  const base_result = {
    esbid: market.esbid,
    market_type: market.market_type,
    selection_pid: market.selection_pid,
    selection_type: market.selection_type,
    selection_metric_line: market.selection_metric_line,
    source_id: market.source_id,
    source_market_id: market.source_market_id,
    source_selection_id: market.source_selection_id,
    metric_value,
    selection_result,
    handler_type,
    error
  }

  return [
    { ...base_result, time_type: 'OPEN' },
    { ...base_result, time_type: 'CLOSE' }
  ]
}

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
 * Fetch OPEN markets for specified games
 * Each fetched OPEN market will generate both OPEN and CLOSE results in the handlers
 *
 * @param {Object} params - Named parameters
 * @param {Array<string>} params.esbids - Game IDs to fetch markets for
 * @param {number} params.year - Season year
 * @param {boolean} params.missing_only - Only fetch unsettled markets
 * @param {Array<string>} params.supported_market_types - Supported market types
 * @returns {Array} OPEN market data (will generate 2x results: OPEN and CLOSE)
 */
export const fetch_markets_for_games = async ({
  esbids,
  year,
  missing_only = false,
  supported_market_types
}) => {
  if (!esbids || esbids.length === 0) return []

  log(`Fetching markets for ${esbids.length} games`)

  const markets = await db('prop_market_selections_index')
    .select(
      'prop_markets_index.esbid',
      'prop_markets_index.market_type',
      'prop_market_selections_index.selection_pid',
      'prop_market_selections_index.selection_metric_line',
      'prop_market_selections_index.selection_type',
      'prop_market_selections_index.source_id',
      'prop_market_selections_index.source_market_id',
      'prop_market_selections_index.source_selection_id'
    )
    .join('prop_markets_index', function () {
      this.on(
        'prop_markets_index.source_id',
        '=',
        'prop_market_selections_index.source_id'
      ).andOn(
        'prop_markets_index.source_market_id',
        '=',
        'prop_market_selections_index.source_market_id'
      )
    })
    .whereIn('prop_markets_index.esbid', esbids)
    .andWhere('prop_markets_index.year', year)
    .andWhere('prop_market_selections_index.time_type', 'OPEN') // Only fetch OPEN markets since we generate both OPEN and CLOSE
    .modify((qb) => {
      if (supported_market_types && supported_market_types.length > 0) {
        qb.whereIn('prop_markets_index.market_type', supported_market_types)
      }
      if (missing_only) {
        qb.where('prop_markets_index.market_settled', false)
      }
    })

  log(`Found ${markets.length} markets`)

  return markets
}
