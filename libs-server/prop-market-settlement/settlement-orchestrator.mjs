import debug from 'debug'

import {
  get_handler_for_market_type,
  HANDLER_TYPES
} from './market-type-mappings.mjs'

const log = debug('settlement-orchestrator')

// Constants for better maintainability
const ERROR_MESSAGES = {
  UNSUPPORTED_MARKET: (market_type) =>
    `Unsupported market type: ${market_type}`,
  HANDLER_NOT_FOUND: (calculator_type) =>
    `Handler not registered for type: ${calculator_type}`,
  CALCULATOR_NOT_FOUND: (calculator_type) =>
    `Calculator not found for type: ${calculator_type}`
}

/**
 * SettlementOrchestrator manages the calculation of prop market settlements
 * by coordinating different calculator types and handling batch processing.
 *
 * The orchestrator groups markets by their required calculator type and processes
 * them in parallel batches for optimal performance.
 *
 * @class SettlementOrchestrator
 */
export class SettlementOrchestrator {
  /**
   * Creates a new SettlementOrchestrator instance
   * @constructor
   */
  constructor() {
    this.calculators = new Map()
    this.market_type_cache = new Map()
  }

  /**
   * Register a calculator for a specific type
   * @param {string} calculator_type - The type identifier for the calculator
   * @param {Object} calculator_instance - The calculator instance with batch_calculate method
   * @throws {Error} If calculator_type is invalid or calculator_instance is missing
   */
  async register_calculator(calculator_type, calculator_instance) {
    if (!calculator_type || typeof calculator_type !== 'string') {
      throw new Error('Calculator type must be a non-empty string')
    }

    if (
      !calculator_instance ||
      typeof calculator_instance.batch_calculate !== 'function'
    ) {
      throw new Error('Calculator instance must have a batch_calculate method')
    }

    log(`Registering calculator: ${calculator_type}`)
    this.calculators.set(calculator_type, calculator_instance)
  }

  /**
   * Get the calculator type for a market type (with caching)
   * @param {string} market_type - The market type to look up
   * @returns {string} The calculator type
   * @private
   */
  _get_calculator_type_for_market(market_type) {
    if (!this.market_type_cache.has(market_type)) {
      this.market_type_cache.set(
        market_type,
        get_handler_for_market_type(market_type)
      )
    }
    return this.market_type_cache.get(market_type)
  }

  /**
   * Calculate results for a batch of markets using appropriate calculators
   * @param {Array<Object>} markets - Array of market objects to process
   * @returns {Promise<Array<Object>>} Array of calculation results
   */
  async batch_calculate_markets(markets) {
    if (!markets || markets.length === 0) {
      log('No markets provided for batch calculation')
      return []
    }

    log(`Processing batch of ${markets.length} markets`)

    const { groups: calculator_batches, unsupported } =
      this._group_markets_by_calculator(markets)

    // Process unsupported markets first
    const unsupported_results = this._process_unsupported_markets(unsupported)

    // Process each calculator type in parallel
    const batch_promises = Object.entries(calculator_batches).map(
      ([calculator_type, calculator_markets]) =>
        this._process_calculator_batch(calculator_type, calculator_markets)
    )

    const batch_results = await Promise.all(batch_promises)

    // Combine all results
    const all_results = [...unsupported_results, ...batch_results.flat()]

    log(`Completed processing ${all_results.length} market calculations`)

    return all_results
  }

  /**
   * Process unsupported markets and return error results
   * @param {Array} unsupported_markets - Array of unsupported market objects
   * @returns {Array} Array of error result objects
   * @private
   */
  _process_unsupported_markets(unsupported_markets) {
    return unsupported_markets.map((market) => ({
      ...market,
      error: ERROR_MESSAGES.UNSUPPORTED_MARKET(market.market_type),
      selection_result: null
    }))
  }

  /**
   * Process a batch of markets for a specific calculator type
   * @param {string} calculator_type - The calculator type
   * @param {Array} markets - Array of market objects
   * @returns {Promise<Array>} Array of result objects
   * @private
   */
  async _process_calculator_batch(calculator_type, markets) {
    const calculator = this.calculators.get(calculator_type)

    if (!calculator) {
      log(`Handler not found for type: ${calculator_type}`)
      return this._create_error_results_for_markets(
        markets,
        ERROR_MESSAGES.HANDLER_NOT_FOUND(calculator_type)
      )
    }

    try {
      return await calculator.batch_calculate(markets)
    } catch (error) {
      log(`Error processing batch for ${calculator_type}: ${error.message}`)
      return this._create_error_results_for_markets(
        markets,
        `Calculator error: ${error.message}`
      )
    }
  }

  /**
   * Create error results for a batch of markets
   * @param {Array} markets - Array of market objects
   * @param {string} error_message - Error message to include
   * @returns {Array} Array of error result objects
   * @private
   */
  _create_error_results_for_markets(markets, error_message) {
    return markets.map((market) => ({
      ...market,
      error: error_message,
      selection_result: null
    }))
  }

  /**
   * Group markets by their required calculator type
   * @param {Array} markets - Array of market objects to group
   * @returns {Object} Object containing groups and unsupported markets
   * @returns {Object} returns.groups - Markets grouped by calculator type
   * @returns {Array} returns.unsupported - Markets with unsupported types
   * @private
   */
  _group_markets_by_calculator(markets) {
    const groups = {}
    const unsupported = []

    for (const market of markets) {
      const calculator_type = this._get_calculator_type_for_market(
        market.market_type
      )

      if (calculator_type === HANDLER_TYPES.UNSUPPORTED) {
        unsupported.push(market)
        continue
      }

      if (!groups[calculator_type]) {
        groups[calculator_type] = []
      }

      groups[calculator_type].push(market)
    }

    return { groups, unsupported }
  }
}

export default SettlementOrchestrator
