/**
 * Market analysis and logging utilities for DraftKings odds import
 */

import debug from 'debug'
import { CONFIG } from './draftkings-constants.mjs'

const log = debug('import-draft-kings')

/**
 * Analyzes formatted markets for missing fields and unmatched market types
 * @param {Array} formatted_markets - Array of formatted market objects
 */
export const analyze_formatted_markets = (formatted_markets) => {
  log(`\n=== MARKET ANALYSIS ===`)

  // Group markets by eventId for both missing esbid and year
  const events_missing_esbid = new Map()
  const events_missing_year = new Map()
  const missing_market_type = []
  const source_markets_missing_market_type = new Set()

  formatted_markets.forEach((market, index) => {
    // Check for missing esbid
    if (
      !('esbid' in market) ||
      market.esbid === null ||
      market.esbid === undefined
    ) {
      const event_id = market.source_event_id
      if (!events_missing_esbid.has(event_id)) {
        events_missing_esbid.set(event_id, {
          event_id,
          event_name: market.source_event_name,
          markets: []
        })
      }
      events_missing_esbid.get(event_id).markets.push({
        index,
        source_market_id: market.source_market_id,
        source_market_name: market.source_market_name
      })
    }

    // Check for missing year
    if (
      !('year' in market) ||
      market.year === null ||
      market.year === undefined
    ) {
      const event_id = market.source_event_id
      if (!events_missing_year.has(event_id)) {
        events_missing_year.set(event_id, {
          event_id,
          event_name: market.source_event_name,
          markets: []
        })
      }
      events_missing_year.get(event_id).markets.push({
        index,
        source_market_id: market.source_market_id,
        source_market_name: market.source_market_name
      })
    }

    // Check for missing market_type
    if (
      !('market_type' in market) ||
      market.market_type === null ||
      market.market_type === undefined ||
      market.market_type === ''
    ) {
      missing_market_type.push({
        index,
        source_market_id: market.source_market_id,
        source_market_name: market.source_market_name
      })

      // Add to set of source_market_names with missing market_type
      if (market.source_market_name) {
        source_markets_missing_market_type.add(market.source_market_name)
      }
    }
  })

  // Report events missing esbid
  log_missing_esbid_analysis(events_missing_esbid)

  // Report events missing year
  log_missing_year_analysis(events_missing_year)

  // Report missing market types
  log_missing_market_type_analysis(
    missing_market_type,
    source_markets_missing_market_type
  )
}

/**
 * Logs analysis of events missing esbid
 * @param {Map} events_missing_esbid - Map of events missing esbid
 */
const log_missing_esbid_analysis = (events_missing_esbid) => {
  const total_markets_missing_esbid = Array.from(
    events_missing_esbid.values()
  ).reduce((sum, event) => sum + event.markets.length, 0)

  log(`Markets missing 'esbid': ${total_markets_missing_esbid}`)
  log(`Events missing 'esbid': ${events_missing_esbid.size}`)

  if (events_missing_esbid.size > 0) {
    log('Events with markets missing esbid:')
    const events_array = Array.from(events_missing_esbid.values())
    events_array
      .slice(0, CONFIG.LOGGING.MAX_EVENTS_DISPLAY)
      .forEach((event, idx) => {
        log(
          `  ${idx + 1}. ${event.event_name} (Event ID: ${event.event_id}) - ${event.markets.length} markets`
        )
      })
    if (events_array.length > CONFIG.LOGGING.MAX_EVENTS_DISPLAY) {
      log(
        `  ... and ${events_array.length - CONFIG.LOGGING.MAX_EVENTS_DISPLAY} more events`
      )
    }
  }
}

/**
 * Logs analysis of events missing year
 * @param {Map} events_missing_year - Map of events missing year
 */
const log_missing_year_analysis = (events_missing_year) => {
  const total_markets_missing_year = Array.from(
    events_missing_year.values()
  ).reduce((sum, event) => sum + event.markets.length, 0)

  log(`Markets missing 'year': ${total_markets_missing_year}`)
  log(`Events missing 'year': ${events_missing_year.size}`)

  if (events_missing_year.size > 0) {
    log('Events with markets missing year:')
    const events_array = Array.from(events_missing_year.values())
    events_array
      .slice(0, CONFIG.LOGGING.MAX_EVENTS_DISPLAY)
      .forEach((event, idx) => {
        log(
          `  ${idx + 1}. ${event.event_name} (Event ID: ${event.event_id}) - ${event.markets.length} markets`
        )
      })
    if (events_array.length > CONFIG.LOGGING.MAX_EVENTS_DISPLAY) {
      log(
        `  ... and ${events_array.length - CONFIG.LOGGING.MAX_EVENTS_DISPLAY} more events`
      )
    }
  }
}

/**
 * Logs analysis of missing market types
 * @param {Array} missing_market_type - Array of markets missing market type
 * @param {Set} source_markets_missing_market_type - Set of unique market names missing type
 */
const log_missing_market_type_analysis = (
  missing_market_type,
  source_markets_missing_market_type
) => {
  log(`Markets missing 'market_type': ${missing_market_type.length}`)

  if (source_markets_missing_market_type.size > 0) {
    log(
      `Unique source_market_names with missing market_type: ${source_markets_missing_market_type.size}`
    )

    // Extract unique category/subcategory/betOfferTypeId combinations
    const unique_category_combinations = new Set()
    const category_combination_examples = new Map()

    missing_market_type.forEach((market) => {
      // Extract category info from source_market_name
      const match = market.source_market_name.match(
        /categoryId: (\d+), subcategoryId: (\d+), betOfferTypeId: (\d+)/
      )
      if (match) {
        const [, category_id, subcategory_id, bet_offer_type_id] = match
        const combination_key = `${category_id}/${subcategory_id}/${bet_offer_type_id}`
        unique_category_combinations.add(combination_key)

        // Store an example market name for this combination
        if (!category_combination_examples.has(combination_key)) {
          // Extract just the category and subcategory part (before the market name)
          const category_part = market.source_market_name
            .split(' - ')
            .slice(0, 2)
            .join(' - ')
          category_combination_examples.set(combination_key, category_part)
        }
      }
    })

    log('Unique category combinations missing market_type:')
    const sorted_combinations = Array.from(unique_category_combinations).sort()
    sorted_combinations.forEach((combination, idx) => {
      const example =
        category_combination_examples.get(combination) || 'Unknown'
      log(
        `  ${idx + 1}. ${example} (categoryId/subcategoryId/betOfferTypeId: ${combination})`
      )
    })

    log(`Total unique category combinations: ${sorted_combinations.length}`)
  }
}

/**
 * Logs summary of failed requests
 * @param {Array} failed_requests - Array of failed request objects
 */
export const log_failed_requests_summary = (failed_requests) => {
  if (failed_requests.length === 0) {
    return
  }

  log(`\n=== FAILED REQUESTS SUMMARY ===`)
  log(`Total failed requests: ${failed_requests.length}`)

  const failures_by_type = failed_requests.reduce((acc, req) => {
    acc[req.type] = (acc[req.type] || 0) + 1
    return acc
  }, {})

  Object.entries(failures_by_type).forEach(([type, count]) => {
    log(`${type}: ${count} failures`)
  })

  log(`\nFirst ${CONFIG.LOGGING.MAX_FAILURES_DISPLAY} failures:`)
  failed_requests
    .slice(0, CONFIG.LOGGING.MAX_FAILURES_DISPLAY)
    .forEach((req) => {
      log(
        `- ${req.type}: ${req.category_name || 'N/A'} -> ${req.subcategory_name || 'N/A'} (${req.error})`
      )
    })
}

/**
 * Logs processing summary
 * @param {Array} formatted_markets - Array of formatted markets
 * @param {Array} failed_requests - Array of failed requests
 */
export const log_processing_summary = (formatted_markets, failed_requests) => {
  log(`\n=== PROCESSING SUMMARY ===`)
  log(`Successfully processed ${formatted_markets.length} markets`)
  log(`Failed requests: ${failed_requests.length}`)

  const total_attempts = formatted_markets.length + failed_requests.length
  const success_rate =
    total_attempts > 0 ? (formatted_markets.length / total_attempts) * 100 : 0
  log(`Success rate: ${success_rate.toFixed(1)}%`)
}
