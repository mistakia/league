import debug from 'debug'

import {
  market_type_mappings,
  get_handler_for_market_type,
  HANDLER_TYPES,
  DATA_SOURCE_REQUIREMENTS
} from './market-type-mappings.mjs'

const log = debug('settlement-orchestrator')

export class SettlementOrchestrator {
  constructor(db) {
    this.db = db
    this.calculators = new Map()
    this.market_type_cache = new Map()
  }

  async register_calculator(calculator_type, calculator_instance) {
    log(`Registering handler: ${calculator_type}`)
    this.calculators.set(calculator_type, calculator_instance)
  }


  _get_calculator_type_cached(market_type) {
    if (!this.market_type_cache.has(market_type)) {
      this.market_type_cache.set(market_type, get_handler_for_market_type(market_type))
    }
    return this.market_type_cache.get(market_type)
  }

  async calculate_market_result({
    esbid,
    market_type,
    selection_pid = null,
    selection_metric_line = null,
    selection_type = null
  }) {
    const calculator_type = this._get_calculator_type_cached(market_type)

    if (calculator_type === HANDLER_TYPES.UNSUPPORTED) {
      return {
        esbid,
        market_type,
        selection_pid,
        selection_metric_line,
        selection_type,
        error: `Unsupported market type: ${market_type}`,
        selection_result: null
      }
    }

    const calculator = this.calculators.get(calculator_type)
    if (!calculator) {
      return {
        esbid,
        market_type,
        selection_pid,
        selection_metric_line,
        selection_type,
        error: `Handler not registered for type: ${calculator_type}`,
        selection_result: null
      }
    }

    const mapping = market_type_mappings[market_type]
    if (!mapping) {
      return {
        esbid,
        market_type,
        selection_pid,
        selection_metric_line,
        selection_type,
        error: `No mapping found for market type: ${market_type}`,
        selection_result: null
      }
    }

    try {
      const result = await calculator.calculate({
        esbid,
        market_type,
        mapping,
        selection_pid,
        selection_metric_line,
        selection_type
      })

      return result
    } catch (error) {
      log(
        `Error calculating result for market ${market_type}: ${error.message}`
      )
      return {
        esbid,
        market_type,
        selection_pid,
        selection_metric_line,
        selection_type,
        error: error.message,
        selection_result: null
      }
    }
  }

  async batch_calculate_markets(markets) {
    const { groups: calculator_batches, unsupported } = this._group_markets_by_calculator(markets)

    // Process unsupported markets first
    const unsupported_results = unsupported.map(market => ({
      ...market,
      error: `Unsupported market type: ${market.market_type}`,
      selection_result: null
    }))

    // Process each calculator type in parallel
    const batch_promises = Object.entries(calculator_batches).map(
      async ([calculator_type, calculator_markets]) => {
        const calculator = this.calculators.get(calculator_type)
        if (!calculator) {
          log(`Handler not found for type: ${calculator_type}`)
          return calculator_markets.map(market => ({
            ...market,
            error: `Handler not registered for type: ${calculator_type}`,
            selection_result: null
          }))
        }

        if (calculator.batch_calculate) {
          // Use batch processing if available
          return await calculator.batch_calculate(calculator_markets)
        } else {
          // Fall back to individual calculations
          const individual_results = []
          for (const market of calculator_markets) {
            try {
              const result = await this.calculate_market_result(market)
              individual_results.push(result)
            } catch (error) {
              log(`Error in individual calculation: ${error.message}`)
              individual_results.push({
                ...market,
                error: error.message,
                selection_result: null
              })
            }
          }
          return individual_results
        }
      }
    )

    const batch_results = await Promise.all(batch_promises)
    
    // Include unsupported market results
    return [...unsupported_results, ...batch_results.flat()]
  }

  _group_markets_by_calculator(markets) {
    const groups = {}
    const unsupported = []

    for (const market of markets) {
      const calculator_type = this._get_calculator_type_cached(market.market_type)

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

  async get_required_data_for_markets(markets) {
    const data_requirements = {}
    const calculator_types = new Set()

    // Determine what calculators we need
    for (const market of markets) {
      const calculator_type = this._get_calculator_type_cached(market.market_type)
      if (calculator_type !== HANDLER_TYPES.UNSUPPORTED) {
        calculator_types.add(calculator_type)
      }
    }

    // Get data requirements for each calculator type
    for (const calculator_type of calculator_types) {
      const requirements = DATA_SOURCE_REQUIREMENTS[calculator_type]
      if (requirements) {
        data_requirements[calculator_type] = requirements
      }
    }

    return data_requirements
  }

  async prefetch_data_for_games(esbids, calculator_types = null) {
    const prefetch_promises = []

    // If no specific calculator types provided, prefetch for all registered calculators
    const types_to_prefetch =
      calculator_types || Array.from(this.calculators.keys())

    for (const calculator_type of types_to_prefetch) {
      const calculator = this.calculators.get(calculator_type)

      if (calculator && calculator.prefetch) {
        log(`Prefetching data for ${calculator_type}`)
        prefetch_promises.push(
          calculator.prefetch(esbids).catch((error) => {
            log(`Error prefetching for ${calculator_type}: ${error.message}`)
            return null
          })
        )
      }
    }

    await Promise.all(prefetch_promises)
    log(`Prefetch completed for ${prefetch_promises.length} calculators`)
  }

  get_supported_market_types() {
    return Object.keys(market_type_mappings).filter(
      (type) => market_type_mappings[type].handler !== HANDLER_TYPES.UNSUPPORTED
    )
  }

  get_registered_handlers() {
    return Array.from(this.calculators.keys())
  }

  get_calculator_coverage() {
    const coverage = {}
    const registered_types = Array.from(this.calculators.keys())

    for (const [market_type, mapping] of Object.entries(market_type_mappings)) {
      const calculator_type = mapping.handler
      const is_registered = registered_types.includes(calculator_type)

      if (!coverage[calculator_type]) {
        coverage[calculator_type] = {
          registered: is_registered,
          market_types: []
        }
      }

      coverage[calculator_type].market_types.push(market_type)
    }

    return coverage
  }

  async health_check(detailed = false) {
    const health_promises = Array.from(this.calculators).map(
      async ([calculator_type, calculator]) => {
        try {
          const healthy = calculator.health_check 
            ? await calculator.health_check()
            : true
          
          if (detailed) {
            return {
              calculator_type,
              healthy,
              error: null
            }
          }
          
          return [calculator_type, healthy]
        } catch (error) {
          if (detailed) {
            return {
              calculator_type,
              healthy: false,
              error: error.message
            }
          }
          
          return [calculator_type, false]
        }
      }
    )

    const results = await Promise.all(health_promises)
    
    if (detailed) {
      return results
    }
    
    return Object.fromEntries(results)
  }


  clear_cache() {
    this.market_type_cache.clear()
    log('Market type cache cleared')
  }
}

export default SettlementOrchestrator
