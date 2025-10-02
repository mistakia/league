/**
 * Filter parsing utilities for DraftKings odds import
 */

import debug from 'debug'
import {
  get_active_categories,
  get_priority_categories
} from './draftkings-tracking.mjs'

const log = debug('import-draft-kings')

/**
 * Parses command line filters and returns category and subcategory filters
 * @param {Object} argv - Command line arguments
 * @returns {Object} - Object with category_filter and subcategory_filter
 */
export const parse_filters = async (argv) => {
  let category_filter = null
  let subcategory_filter = null

  // Parse category filter
  if (argv.categories) {
    const category_ids = argv.categories
      .split(',')
      .map((id) => Number(id))
      .filter((id) => !isNaN(id))
    category_filter = category_ids.length > 0 ? category_ids : null
  }

  // Parse subcategory filter
  if (argv.subcategories) {
    const subcategory_ids = argv.subcategories
      .split(',')
      .map((id) => Number(id))
      .filter((id) => !isNaN(id))
    subcategory_filter = subcategory_ids.length > 0 ? subcategory_ids : null
  }

  // Apply tracking-based filtering if specified
  if (argv.useTracking) {
    const tracking_result = await apply_tracking_filter(argv)
    category_filter = tracking_result.category_filter
    subcategory_filter = tracking_result.subcategory_filter
  }

  return { category_filter, subcategory_filter }
}

/**
 * Applies tracking-based filtering
 * @param {Object} argv - Command line arguments
 * @returns {Object} - Object with category_filter and subcategory_filter
 */
const apply_tracking_filter = async (argv) => {
  log(`Using tracking filter: ${argv.useTracking}`)

  let tracking_categories = []
  if (argv.useTracking === 'active') {
    tracking_categories = await get_active_categories(argv.trackingDays)
    log(
      `Found ${tracking_categories.length} active categories (last ${argv.trackingDays} days)`
    )
  } else if (argv.useTracking === 'priority') {
    tracking_categories = await get_priority_categories()
    log(`Found ${tracking_categories.length} priority categories`)
  }

  if (tracking_categories.length > 0) {
    // Extract category and subcategory IDs from tracking data
    const tracking_category_ids = [
      ...new Set(tracking_categories.map((cat) => cat.category_id))
    ]
    const tracking_subcategory_ids = [
      ...new Set(
        tracking_categories.map((cat) => cat.subcategory_id).filter(Boolean)
      )
    ]

    log(
      `Tracking filter applied: ${tracking_category_ids.length} categories, ${tracking_subcategory_ids.length} subcategories`
    )

    return {
      category_filter: tracking_category_ids,
      subcategory_filter:
        tracking_subcategory_ids.length > 0 ? tracking_subcategory_ids : null
    }
  } else {
    log('No categories found from tracking data, using all categories')
    return { category_filter: null, subcategory_filter: null }
  }
}
