/**
 * Processing modes for DraftKings odds import
 */

import debug from 'debug'
import * as draftkings from './index.mjs'
import { wait } from '#libs-server/wait.mjs'
import { track_category_activity } from './draftkings-tracking.mjs'
import { format_market } from './draftkings-formatters.mjs'
import { CONFIG } from './draftkings-constants.mjs'

const log = debug('import-draft-kings')

/**
 * Processes all categories and subcategories
 * @param {Object} params - Parameters object
 * @param {Array} params.nfl_games - Array of NFL games
 * @param {number} params.timestamp - Timestamp for formatting
 * @param {Array} params.category_filter - Optional category filter
 * @param {Array} params.subcategory_filter - Optional subcategory filter
 * @returns {Object} - Processing results
 */
export const run_all_mode = async ({
  nfl_games,
  timestamp,
  category_filter,
  subcategory_filter
}) => {
  const formatted_markets = []
  const all_markets = []
  const failed_requests = []

  // Get all categories and subcategories from league data
  let league_data
  try {
    league_data = await draftkings.get_league_data_v1()
    log(
      `Found ${league_data.categories?.length || 0} categories and ${league_data.subcategories?.length || 0} subcategories`
    )
  } catch (err) {
    log(`Failed to get league data: ${err.message}`)
    throw err
  }

  // Group subcategories by categoryId for easier processing
  const subcategories_by_category = {}
  for (const subcategory of league_data.subcategories || []) {
    if (!subcategories_by_category[subcategory.categoryId]) {
      subcategories_by_category[subcategory.categoryId] = []
    }
    subcategories_by_category[subcategory.categoryId].push(subcategory)
  }

  // Build list of subcategories to process
  const subcategories_to_process = build_subcategories_to_process(
    league_data.categories || [],
    subcategories_by_category,
    category_filter,
    subcategory_filter
  )

  log_processing_info(league_data, category_filter, subcategory_filter)

  // Track performance stats
  const stats = {
    subcategories_checked: 0,
    subcategories_with_offers: 0,
    total_offers: 0
  }

  let consecutive_empty_count = 0

  // Process each subcategory
  for (const subcategory of subcategories_to_process) {
    const result = await process_subcategory(
      subcategory,
      nfl_games,
      timestamp,
      stats,
      consecutive_empty_count
    )

    formatted_markets.push(...result.formatted_markets)
    all_markets.push(...result.all_markets)
    failed_requests.push(...result.failed_requests)
    consecutive_empty_count = result.consecutive_empty_count
  }

  log_subcategory_summary(stats)

  return { formatted_markets, all_markets, failed_requests }
}

/**
 * Processes specific events with their categories
 * @param {Object} params - Parameters object
 * @param {Array} params.nfl_games - Array of NFL games
 * @param {number} params.timestamp - Timestamp for formatting
 * @param {Array} params.category_filter - Optional category filter
 * @param {Array} params.subcategory_filter - Optional subcategory filter
 * @param {Array} params.event_filter - Optional event filter
 * @returns {Object} - Processing results
 */
export const run_events_mode = async ({
  nfl_games,
  timestamp,
  category_filter,
  subcategory_filter,
  event_filter
}) => {
  const formatted_markets = []
  const all_markets = []
  const failed_requests = []

  // Get league data to get events
  let league_data
  try {
    league_data = await draftkings.get_league_data_v1()
    log(`Found ${league_data.events?.length || 0} events`)
  } catch (err) {
    log(`Failed to get league data: ${err.message}`)
    throw err
  }

  // Build subcategory lookup map from league data
  const subcategory_lookup = build_subcategory_lookup(league_data.subcategories)

  let events_to_process = league_data.events || []

  // Apply event filter if provided
  if (event_filter) {
    events_to_process = events_to_process.filter((event) =>
      event_filter.includes(event.id)
    )
    log(
      `Filtered to ${events_to_process.length} events: ${event_filter.join(', ')}`
    )
  }

  // Process each event
  for (const event of events_to_process) {
    const result = await process_event(
      event,
      nfl_games,
      timestamp,
      category_filter,
      subcategory_filter,
      subcategory_lookup
    )

    formatted_markets.push(...result.formatted_markets)
    all_markets.push(...result.all_markets)
    failed_requests.push(...result.failed_requests)
  }

  return { formatted_markets, all_markets, failed_requests }
}

/**
 * Builds list of subcategories to process based on filters
 * @param {Array} categories - Array of categories
 * @param {Object} subcategories_by_category - Subcategories grouped by category
 * @param {Array} category_filter - Optional category filter
 * @param {Array} subcategory_filter - Optional subcategory filter
 * @returns {Array} - Array of subcategories to process
 */
const build_subcategories_to_process = (
  categories,
  subcategories_by_category,
  category_filter,
  subcategory_filter
) => {
  const subcategories_to_process = []

  for (const category of categories) {
    // Apply category filter
    if (category_filter && !category_filter.includes(category.id)) {
      continue
    }

    const category_subcategories = subcategories_by_category[category.id] || []

    for (const subcategory of category_subcategories) {
      // Apply subcategory filter
      if (subcategory_filter && !subcategory_filter.includes(subcategory.id)) {
        continue
      }

      subcategories_to_process.push({
        category_id: category.id,
        category_name: category.name,
        subcategory_id: subcategory.id,
        subcategory_name: subcategory.name
      })
    }
  }

  return subcategories_to_process
}

/**
 * Builds subcategory lookup map
 * @param {Array} subcategories - Array of subcategories
 * @returns {Object} - Subcategory lookup map
 */
const build_subcategory_lookup = (subcategories) => {
  const subcategory_lookup = {}
  if (subcategories) {
    for (const subcategory of subcategories) {
      subcategory_lookup[subcategory.id] = subcategory.name
    }
    log(
      `Built subcategory lookup with ${Object.keys(subcategory_lookup).length} entries`
    )
  }
  return subcategory_lookup
}

/**
 * Logs processing information
 * @param {Object} league_data - League data object
 * @param {Array} category_filter - Category filter
 * @param {Array} subcategory_filter - Subcategory filter
 */
const log_processing_info = (
  league_data,
  category_filter,
  subcategory_filter
) => {
  log(`Categories found: ${league_data.categories?.length || 0}`)
  log(`Subcategories found: ${league_data.subcategories?.length || 0}`)
  log(
    `Category filter: ${category_filter ? category_filter.join(', ') : 'none'}`
  )
  log(
    `Subcategory filter: ${subcategory_filter ? subcategory_filter.join(', ') : 'none'}`
  )
}

/**
 * Processes a single subcategory
 * @param {Object} subcategory - Subcategory to process
 * @param {Array} nfl_games - Array of NFL games
 * @param {number} timestamp - Timestamp for formatting
 * @param {Object} stats - Processing stats object
 * @param {number} consecutive_empty_count - Current consecutive empty count
 * @returns {Object} - Processing result
 */
const process_subcategory = async (
  subcategory,
  nfl_games,
  timestamp,
  stats,
  consecutive_empty_count
) => {
  const { category_id, category_name, subcategory_id, subcategory_name } =
    subcategory
  const formatted_markets = []
  const all_markets = []
  const failed_requests = []

  stats.subcategories_checked++

  log(
    `Processing: ${category_name} -> ${subcategory_name} (${category_id}/${subcategory_id})`
  )

  let raw_data
  try {
    raw_data = await draftkings.get_subcategory_data_v1({
      categoryId: category_id,
      subcategoryId: subcategory_id
    })
  } catch (err) {
    log(
      `Failed to get offers for ${category_name} -> ${subcategory_name}: ${err.message}`
    )
    failed_requests.push({
      type: 'offers',
      category_id,
      subcategory_id,
      category_name,
      subcategory_name,
      error: err.message
    })
    await wait(CONFIG.WAIT_TIMES.ERROR_RETRY)
    return {
      formatted_markets,
      all_markets,
      failed_requests,
      consecutive_empty_count
    }
  }

  // Use raw API data directly
  const draftkings_markets = raw_data.markets || []
  const draftkings_selections = raw_data.selections || []
  const draftkings_events = raw_data.events || []

  // Track category activity
  await track_category_activity({
    category_id,
    subcategory_id,
    category_name,
    subcategory_name,
    offers_found: draftkings_markets?.length || 0
  })

  if (!draftkings_markets || draftkings_markets.length === 0) {
    consecutive_empty_count++
    log(`No offers found for ${category_name} -> ${subcategory_name}`)
    // Use adaptive wait time based on consecutive empty results
    const wait_time = Math.max(
      CONFIG.WAIT_TIMES.EMPTY_RESULT,
      CONFIG.WAIT_TIMES.EMPTY_RESULT_MAX -
        consecutive_empty_count * CONFIG.WAIT_TIMES.EMPTY_RESULT_DECREMENT
    )
    await wait(wait_time)
    return {
      formatted_markets,
      all_markets,
      failed_requests,
      consecutive_empty_count
    }
  }

  // Reset empty count on successful find
  consecutive_empty_count = 0
  stats.subcategories_with_offers++
  stats.total_offers += draftkings_markets.length

  log(
    `Found ${draftkings_markets.length} offers for ${category_name} -> ${subcategory_name}`
  )

  // Format all markets for this subcategory
  for (const draftkings_market of draftkings_markets) {
    try {
      all_markets.push(draftkings_market)

      const formatted_market = await format_market({
        draftkings_market,
        draftkings_selections,
        draftkings_events,
        draftkings_offer_category: {
          offerCategoryId: category_id,
          name: category_name
        },
        draftkings_offer_sub_category: {
          subcategoryId: subcategory_id,
          name: subcategory_name
        },
        format_timestamp: timestamp,
        nfl_games
      })

      if (formatted_market) {
        formatted_markets.push(formatted_market)
      }
    } catch (err) {
      log(`Failed to format market ${draftkings_market.id}: ${err.message}`)
      log(`Stack trace: ${err.stack}`)
      failed_requests.push({
        type: 'format',
        category_id,
        subcategory_id,
        offer_id: draftkings_market.id,
        error: err.message,
        stack: err.stack
      })
    }
  }

  // Adaptive wait time based on request success
  await wait(
    consecutive_empty_count > CONFIG.WAIT_TIMES.CONSECUTIVE_EMPTY_THRESHOLD
      ? CONFIG.WAIT_TIMES.CONSECUTIVE_EMPTY_WAIT
      : CONFIG.WAIT_TIMES.DEFAULT
  )

  return {
    formatted_markets,
    all_markets,
    failed_requests,
    consecutive_empty_count
  }
}

/**
 * Processes a single event
 * @param {Object} event - Event to process
 * @param {Array} nfl_games - Array of NFL games
 * @param {number} timestamp - Timestamp for formatting
 * @param {Array} category_filter - Optional category filter
 * @param {Array} subcategory_filter - Optional subcategory filter
 * @param {Object} subcategory_lookup - Subcategory lookup map
 * @returns {Object} - Processing result
 */
const process_event = async (
  event,
  nfl_games,
  timestamp,
  category_filter,
  subcategory_filter,
  subcategory_lookup
) => {
  const formatted_markets = []
  const all_markets = []
  const failed_requests = []

  log(`\nProcessing event: ${event.name} (${event.id})`)

  try {
    // Get categories for this event
    const event_categories = await draftkings.get_event_categories({
      eventId: event.id
    })
    log(`Found ${event_categories.length} categories for event ${event.id}`)

    // Apply category filter
    let categories_to_process = event_categories
    if (category_filter) {
      categories_to_process = event_categories.filter((cat) =>
        category_filter.includes(cat.id)
      )
    }

    for (const category of categories_to_process) {
      const result = await process_event_category(
        event,
        category,
        nfl_games,
        timestamp,
        subcategory_filter,
        subcategory_lookup
      )

      formatted_markets.push(...result.formatted_markets)
      all_markets.push(...result.all_markets)
      failed_requests.push(...result.failed_requests)
    }

    await wait(CONFIG.WAIT_TIMES.EVENT_PROCESSING)
  } catch (err) {
    log(`Failed to get categories for event ${event.id}: ${err.message}`)
    failed_requests.push({
      type: 'event_categories',
      event_id: event.id,
      event_name: event.name,
      error: err.message
    })
  }

  return { formatted_markets, all_markets, failed_requests }
}

/**
 * Processes a single event category
 * @param {Object} event - Event object
 * @param {Object} category - Category object
 * @param {Array} nfl_games - Array of NFL games
 * @param {number} timestamp - Timestamp for formatting
 * @param {Array} subcategory_filter - Optional subcategory filter
 * @param {Object} subcategory_lookup - Subcategory lookup map
 * @returns {Object} - Processing result
 */
const process_event_category = async (
  event,
  category,
  nfl_games,
  timestamp,
  subcategory_filter,
  subcategory_lookup
) => {
  const formatted_markets = []
  const all_markets = []
  const failed_requests = []

  log(`Processing category: ${category.name} (${category.id})`)

  try {
    // Get event category data (returns all subcategory offers for this event/category)
    const raw_data = await draftkings.get_event_category_data({
      eventId: event.id,
      categoryId: category.id
    })

    // Process raw markets
    const draftkings_markets = raw_data.markets || []
    const draftkings_selections = raw_data.selections || []
    const draftkings_events = raw_data.events || []

    // Apply subcategory filter
    let filtered_draftkings_markets = draftkings_markets
    if (subcategory_filter) {
      filtered_draftkings_markets = draftkings_markets.filter((market) =>
        subcategory_filter.includes(market.subcategoryId)
      )
      log(
        `Filtered markets from ${draftkings_markets.length} to ${filtered_draftkings_markets.length} based on subcategory filter`
      )
    }

    log(
      `Found ${filtered_draftkings_markets.length} markets for ${category.name}`
    )

    // Format markets using raw data
    for (const draftkings_market of filtered_draftkings_markets) {
      all_markets.push(draftkings_market)

      // Get subcategory info from the market
      const draftkings_offer_sub_category = {
        subcategoryId: draftkings_market.subcategoryId,
        name: subcategory_lookup[draftkings_market.subcategoryId] || 'Unknown'
      }

      const draftkings_offer_category = {
        offerCategoryId: category.id,
        name: category.name
      }

      const formatted_market = await format_market({
        draftkings_market,
        draftkings_selections,
        draftkings_events,
        draftkings_offer_category,
        draftkings_offer_sub_category,
        format_timestamp: timestamp,
        nfl_games
      })

      if (formatted_market) {
        formatted_markets.push(formatted_market)
      }
    }

    await wait(CONFIG.WAIT_TIMES.EVENT_PROCESSING)
  } catch (err) {
    log(
      `Failed to get category data for event ${event.id}, category ${category.id}: ${err.message}`
    )
    failed_requests.push({
      type: 'event_category',
      event_id: event.id,
      event_name: event.name,
      category_id: category.id,
      category_name: category.name,
      error: err.message
    })
  }

  return { formatted_markets, all_markets, failed_requests }
}

/**
 * Logs subcategory processing summary
 * @param {Object} stats - Processing stats
 */
const log_subcategory_summary = (stats) => {
  log(`\n=== SUBCATEGORY SUMMARY ===`)
  log(`Subcategories checked: ${stats.subcategories_checked}`)
  log(`Subcategories with offers: ${stats.subcategories_with_offers}`)
  log(`Total offers found: ${stats.total_offers}`)
  log(
    `Success rate: ${((stats.subcategories_with_offers / stats.subcategories_checked) * 100).toFixed(1)}%`
  )
}
