/**
 * Parses a standard selection ID back into its component parts
 *
 * Format: {event_identifier}|MARKET:{market_type}|{subject}|SEL:{selection_type}|LINE:{line}
 *
 * @param {string} selection_id - The selection ID to parse
 * @returns {Object} Parsed components
 * @returns {string} [result.esbid] - Event Sports Business ID for game events
 * @returns {number} [result.year] - Season year for non-game events
 * @returns {string} [result.seas_type] - Season type: REG, POST, PRE
 * @returns {number} [result.week] - Week number for week/day events
 * @returns {string} [result.day] - Day value for day events
 * @returns {string} result.market_type - Market type
 * @returns {string} [result.pid] - Player ID for player props
 * @returns {string} [result.team] - Team code for team props
 * @returns {string} [result.selection_type] - OVER, UNDER, YES, NO
 * @returns {number|string} [result.line] - Line value
 * @returns {string} result.event_type - Detected event type: 'game', 'season', 'week', 'day'
 * @throws {Error} If the selection ID format is invalid
 */
const parse_standard_selection_id = (selection_id) => {
  if (!selection_id || typeof selection_id !== 'string') {
    throw new Error('selection_id must be a non-empty string')
  }

  const parts = selection_id.split('|')
  const result = {}

  for (const part of parts) {
    const colon_index = part.indexOf(':')
    if (colon_index === -1) {
      throw new Error(`Invalid key-value pair: ${part}`)
    }

    const key = part.substring(0, colon_index)
    const value = part.substring(colon_index + 1)

    switch (key) {
      case 'ESBID':
        result.esbid = value
        break
      case 'SEAS':
        result.year = parseInt(value, 10)
        break
      case 'SEAS_TYPE':
        result.seas_type = value
        break
      case 'WEEK':
        result.week = parseInt(value, 10)
        break
      case 'DAY':
        result.day = value
        break
      case 'MARKET':
        result.market_type = value
        break
      case 'PID':
        result.pid = value
        break
      case 'TEAM':
        result.team = value
        break
      case 'SEL':
        result.selection_type = value
        break
      case 'LINE':
        // Preserve line as-is (could be numeric or string with sign)
        result.line = value.includes('.')
          ? parseFloat(value)
          : parseInt(value, 10)
        // Handle signed values like -3.5
        if (isNaN(result.line)) {
          result.line = value
        }
        break
      default:
        throw new Error(`Unknown key in selection ID: ${key}`)
    }
  }

  // Validate required field
  if (!result.market_type) {
    throw new Error('Selection ID must contain MARKET field')
  }

  // Determine event type
  if (result.esbid) {
    result.event_type = 'game'
  } else if (result.year !== undefined) {
    if (result.day) {
      result.event_type = 'day'
    } else if (result.week !== undefined) {
      result.event_type = 'week'
    } else {
      result.event_type = 'season'
    }
  } else {
    throw new Error('Selection ID must contain either ESBID or SEAS field')
  }

  return result
}

export default parse_standard_selection_id
