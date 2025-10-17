/* global localStorage */

/**
 * Local storage helper - provides promise-based interface to localStorage
 * Mirrors the localStorageAdapter from utils but avoids import issues in test environment
 */
const local_storage_helper = {
  async getItem(key) {
    const data = JSON.parse(localStorage.getItem(key))
    return data
  },

  setItem(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  },

  removeItem(key) {
    localStorage.removeItem(key)
  }
}

/**
 * Configuration constants for browser-based data view persistence
 */
const DATA_VIEW_BROWSER_STORAGE_CONFIG = {
  MAX_SNAPSHOTS_PER_VIEW: 20,
  MAX_VIEWS_CACHED: 50,
  STORAGE_KEY_PREFIX: 'data_view_history_',
  METADATA_KEY: 'data_view_metadata',
  LAST_ACTIVE_KEY: 'data_view_last_active'
}

/**
 * Save a table state snapshot to browser localStorage with history management
 *
 * @param {Object} params - Named parameters
 * @param {string} params.view_id - The data view UUID
 * @param {Object} params.table_state - The table state object to save
 * @param {string} params.change_type - Type of change: 'user_edit' or 'server_save'
 * @returns {Promise<void>}
 *
 * @description
 * Adds a new snapshot to the view's history in localStorage.
 * Automatically trims history to MAX_SNAPSHOTS_PER_VIEW using FIFO eviction.
 * Handles QuotaExceededError by attempting cleanup and degrading gracefully.
 */
export const data_view_browser_storage_save_snapshot = async ({
  view_id,
  table_state,
  change_type
}) => {
  try {
    const storage_key = `${DATA_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`

    // Load existing history or initialize empty array
    let history = []
    try {
      history = (await local_storage_helper.getItem(storage_key)) || []
    } catch (e) {
      // If parse fails, start fresh
      history = []
    }

    // Create new snapshot
    const snapshot = {
      table_state,
      change_type,
      timestamp: Date.now()
    }

    // Add to history
    history.push(snapshot)

    // Trim to max size (FIFO - remove oldest)
    if (
      history.length > DATA_VIEW_BROWSER_STORAGE_CONFIG.MAX_SNAPSHOTS_PER_VIEW
    ) {
      history = history.slice(
        -DATA_VIEW_BROWSER_STORAGE_CONFIG.MAX_SNAPSHOTS_PER_VIEW
      )
    }

    // Save back to localStorage
    local_storage_helper.setItem(storage_key, history)

    // Update metadata to track this view
    await data_view_browser_storage_update_metadata_for_view(view_id)
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      // Attempt aggressive cleanup
      try {
        await data_view_browser_storage_cleanup_old_views()
        // Retry save after cleanup
        const storage_key = `${DATA_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`
        const snapshot = {
          table_state,
          change_type,
          timestamp: Date.now()
        }
        local_storage_helper.setItem(storage_key, [snapshot])
      } catch (cleanup_error) {
        // Degrade gracefully - log but don't fail
        console.error(
          'Browser storage quota exceeded, unable to save:',
          cleanup_error
        )
      }
    } else {
      // Log other errors but don't fail
      console.error('Error saving browser storage snapshot:', error)
    }
  }
}

/**
 * Load the full history of snapshots for a view
 *
 * @param {string} view_id - The data view UUID
 * @returns {Promise<Array>} Array of snapshot objects or empty array
 *
 * @description
 * Retrieves all stored snapshots for a view from localStorage.
 * Returns empty array if no history exists or if data is corrupted.
 */
export const data_view_browser_storage_load_view_history = async (view_id) => {
  try {
    const storage_key = `${DATA_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`
    const history = await local_storage_helper.getItem(storage_key)
    return history || []
  } catch (error) {
    // Return empty array on any error (including JSON parse failures)
    console.error('Error loading browser storage history:', error)
    return []
  }
}

/**
 * Get the most recent snapshot for a view
 *
 * @param {string} view_id - The data view UUID
 * @returns {Promise<Object|null>} Most recent snapshot object or null if no history
 *
 * @description
 * Convenience function to retrieve just the latest snapshot without loading full history.
 */
export const data_view_browser_storage_get_latest_snapshot = async (
  view_id
) => {
  try {
    const history = await data_view_browser_storage_load_view_history(view_id)
    if (history.length === 0) {
      return null
    }
    return history[history.length - 1]
  } catch (error) {
    console.error('Error getting latest browser storage snapshot:', error)
    return null
  }
}

/**
 * Clean up old views using LRU eviction strategy
 *
 * @returns {Promise<void>}
 *
 * @description
 * Implements LRU (Least Recently Used) eviction to keep total cached views
 * at or below MAX_VIEWS_CACHED. Uses metadata to track view access times.
 * Removes oldest views until under the limit.
 */
export const data_view_browser_storage_cleanup_old_views = async () => {
  try {
    // Load metadata
    const metadata = await data_view_browser_storage_load_metadata()
    const { view_access_times = {} } = metadata

    const view_ids = Object.keys(view_access_times)

    // Always update last_cleanup timestamp, even if no cleanup needed
    metadata.last_cleanup = Date.now()

    // Check if cleanup needed
    if (view_ids.length <= DATA_VIEW_BROWSER_STORAGE_CONFIG.MAX_VIEWS_CACHED) {
      // No cleanup needed, but still update metadata timestamp
      local_storage_helper.setItem(
        DATA_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY,
        metadata
      )
      return
    }

    // Sort views by access time (oldest first)
    const sorted_view_ids = view_ids.sort((a, b) => {
      return view_access_times[a] - view_access_times[b]
    })

    // Calculate how many to remove
    const views_to_remove =
      view_ids.length - DATA_VIEW_BROWSER_STORAGE_CONFIG.MAX_VIEWS_CACHED
    const remove_ids = sorted_view_ids.slice(0, views_to_remove)

    // Remove old views (just remove localStorage keys, update metadata in batch below)
    for (const view_id of remove_ids) {
      const storage_key = `${DATA_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`
      local_storage_helper.removeItem(storage_key)
      // Remove from metadata view_access_times
      delete metadata.view_access_times[view_id]
    }

    // Update metadata with removed views (timestamp already set above)
    local_storage_helper.setItem(
      DATA_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY,
      metadata
    )
  } catch (error) {
    console.error('Error during browser storage cleanup:', error)
  }
}

/**
 * Clear all history for a specific view
 *
 * @param {string} view_id - The data view UUID to clear
 * @returns {Promise<void>}
 *
 * @description
 * Removes the localStorage entry for a view and updates metadata.
 * Called when a view is deleted or during LRU cleanup.
 */
export const data_view_browser_storage_clear_view_history = async (view_id) => {
  try {
    const storage_key = `${DATA_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`
    local_storage_helper.removeItem(storage_key)

    // Update metadata to remove this view
    const metadata = await data_view_browser_storage_load_metadata()
    if (metadata.view_access_times && metadata.view_access_times[view_id]) {
      delete metadata.view_access_times[view_id]
      local_storage_helper.setItem(
        DATA_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY,
        metadata
      )
    }
  } catch (error) {
    console.error('Error clearing browser storage view history:', error)
  }
}

/**
 * Set the last active view ID and timestamp
 *
 * @param {string} view_id - The data view UUID
 * @returns {Promise<void>}
 *
 * @description
 * Tracks which view was most recently accessed for restoration on page load.
 */
export const data_view_browser_storage_set_last_active_view = async (
  view_id
) => {
  try {
    const last_active = {
      view_id,
      timestamp: Date.now()
    }
    local_storage_helper.setItem(
      DATA_VIEW_BROWSER_STORAGE_CONFIG.LAST_ACTIVE_KEY,
      last_active
    )
  } catch (error) {
    console.error('Error setting last active view:', error)
  }
}

/**
 * Get the last active view ID and timestamp
 *
 * @returns {Promise<Object|null>} Object with view_id and timestamp, or null
 *
 * @description
 * Retrieves the most recently accessed view for restoration on app init.
 */
export const data_view_browser_storage_get_last_active_view = async () => {
  try {
    const last_active = await local_storage_helper.getItem(
      DATA_VIEW_BROWSER_STORAGE_CONFIG.LAST_ACTIVE_KEY
    )
    return last_active || null
  } catch (error) {
    console.error('Error getting last active view:', error)
    return null
  }
}

/**
 * Load metadata object from localStorage
 *
 * @returns {Promise<Object>} Metadata object with view_access_times and version info
 */
export const data_view_browser_storage_load_metadata = async () => {
  try {
    const metadata = await local_storage_helper.getItem(
      DATA_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY
    )
    return (
      metadata || {
        version: 1,
        view_access_times: {},
        last_cleanup: null
      }
    )
  } catch (error) {
    return {
      version: 1,
      view_access_times: {},
      last_cleanup: null
    }
  }
}

/**
 * Update metadata to track view access time
 *
 * @param {string} view_id - The data view UUID
 * @returns {Promise<void>}
 * @private
 */
const data_view_browser_storage_update_metadata_for_view = async (view_id) => {
  try {
    const metadata = await data_view_browser_storage_load_metadata()
    if (!metadata.view_access_times) {
      metadata.view_access_times = {}
    }
    metadata.view_access_times[view_id] = Date.now()
    local_storage_helper.setItem(
      DATA_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY,
      metadata
    )
  } catch (error) {
    console.error('Error updating metadata for view:', error)
  }
}

/**
 * Get all view IDs that have browser storage data
 *
 * @returns {Promise<Array<string>>} Array of view IDs
 *
 * @description
 * Returns all view IDs that have snapshots saved in browser storage.
 * Useful for restoring unsaved views that don't exist on the server.
 */
export const data_view_browser_storage_get_all_view_ids = async () => {
  try {
    const metadata = await data_view_browser_storage_load_metadata()
    return Object.keys(metadata.view_access_times || {})
  } catch (error) {
    console.error('Error getting all view IDs from browser storage:', error)
    return []
  }
}
