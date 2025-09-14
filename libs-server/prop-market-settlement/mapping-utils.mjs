import { market_type_mappings } from './market-type-mappings.mjs'

/**
 * Get the mapping for a market, with fallback to market_type_mappings
 * @param {Object} market - The market object
 * @returns {Object} The mapping configuration
 */
export const get_market_mapping_with_fallback = (market) => {
  return market.mapping || market_type_mappings[market.market_type]
}
