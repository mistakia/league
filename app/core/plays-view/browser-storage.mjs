/* global localStorage */

const local_storage_helper = {
  async getItem(key) {
    try {
      const raw_data = localStorage.getItem(key)
      if (raw_data === null) {
        return null
      }
      const data = JSON.parse(raw_data)
      return data
    } catch (error) {
      console.error(`Failed to parse localStorage item "${key}":`, error)
      localStorage.removeItem(key)
      return null
    }
  },

  setItem(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  },

  removeItem(key) {
    localStorage.removeItem(key)
  }
}

const sanitize_params = (params) => {
  if (!params || typeof params !== 'object') {
    return params
  }

  const sanitized = {}
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      sanitized[key] = value
        .flat(Infinity)
        .filter((v) => v !== undefined && v !== null && v !== '')
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

const sanitize_table_state = (table_state) => {
  if (!table_state) return table_state
  return {
    ...table_state,
    columns: table_state.columns?.map((col) => {
      if (typeof col === 'string') return col
      return { ...col, params: sanitize_params(col.params) }
    }),
    prefix_columns: table_state.prefix_columns?.map((col) => {
      if (typeof col === 'string') return col
      return { ...col, params: sanitize_params(col.params) }
    }),
    where: table_state.where?.map((clause) => ({
      ...clause,
      params: sanitize_params(clause.params)
    }))
  }
}

const PLAYS_VIEW_BROWSER_STORAGE_CONFIG = {
  MAX_SNAPSHOTS_PER_VIEW: 20,
  MAX_VIEWS_CACHED: 50,
  STORAGE_KEY_PREFIX: 'plays_view_history_',
  METADATA_KEY: 'plays_view_metadata',
  LAST_ACTIVE_KEY: 'plays_view_last_active'
}

export const plays_view_browser_storage_save_snapshot = async ({
  view_id,
  table_state,
  change_type
}) => {
  const snapshot = {
    table_state: sanitize_table_state(table_state),
    change_type,
    timestamp: Date.now()
  }

  try {
    const storage_key = `${PLAYS_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`

    let history = []
    try {
      history = (await local_storage_helper.getItem(storage_key)) || []
    } catch (e) {
      history = []
    }

    history.push(snapshot)

    if (
      history.length > PLAYS_VIEW_BROWSER_STORAGE_CONFIG.MAX_SNAPSHOTS_PER_VIEW
    ) {
      history = history.slice(
        -PLAYS_VIEW_BROWSER_STORAGE_CONFIG.MAX_SNAPSHOTS_PER_VIEW
      )
    }

    local_storage_helper.setItem(storage_key, history)
    await plays_view_browser_storage_update_metadata_for_view(view_id)
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      try {
        await plays_view_browser_storage_cleanup_old_views()
        const retry_key = `${PLAYS_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`
        local_storage_helper.setItem(retry_key, [snapshot])
      } catch (cleanup_error) {
        console.error(
          'Browser storage quota exceeded, unable to save:',
          cleanup_error
        )
      }
    } else {
      console.error('Error saving browser storage snapshot:', error)
    }
  }
}

const plays_view_browser_storage_load_view_history = async (
  view_id
) => {
  try {
    const storage_key = `${PLAYS_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`
    const history = await local_storage_helper.getItem(storage_key)
    if (!history || !Array.isArray(history)) {
      return []
    }
    return history.map((snapshot) => {
      if (!snapshot || !snapshot.table_state) return snapshot
      return {
        ...snapshot,
        table_state: sanitize_table_state(snapshot.table_state)
      }
    })
  } catch (error) {
    console.error('Error loading browser storage history:', error)
    return []
  }
}

export const plays_view_browser_storage_get_latest_snapshot = async (
  view_id
) => {
  try {
    const history =
      await plays_view_browser_storage_load_view_history(view_id)
    if (history.length === 0) {
      return null
    }
    return history[history.length - 1]
  } catch (error) {
    console.error('Error getting latest browser storage snapshot:', error)
    return null
  }
}

export const plays_view_browser_storage_cleanup_old_views = async () => {
  try {
    const metadata = await plays_view_browser_storage_load_metadata()
    const { view_access_times = {} } = metadata

    const view_ids = Object.keys(view_access_times)

    metadata.last_cleanup = Date.now()

    if (
      view_ids.length <= PLAYS_VIEW_BROWSER_STORAGE_CONFIG.MAX_VIEWS_CACHED
    ) {
      local_storage_helper.setItem(
        PLAYS_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY,
        metadata
      )
      return
    }

    const sorted_view_ids = view_ids.sort((a, b) => {
      return view_access_times[a] - view_access_times[b]
    })

    const views_to_remove =
      view_ids.length - PLAYS_VIEW_BROWSER_STORAGE_CONFIG.MAX_VIEWS_CACHED
    const remove_ids = sorted_view_ids.slice(0, views_to_remove)

    for (const view_id of remove_ids) {
      const storage_key = `${PLAYS_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`
      local_storage_helper.removeItem(storage_key)
      delete metadata.view_access_times[view_id]
    }

    local_storage_helper.setItem(
      PLAYS_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY,
      metadata
    )
  } catch (error) {
    console.error('Error during browser storage cleanup:', error)
  }
}

export const plays_view_browser_storage_clear_view_history = async (
  view_id
) => {
  try {
    const storage_key = `${PLAYS_VIEW_BROWSER_STORAGE_CONFIG.STORAGE_KEY_PREFIX}${view_id}`
    local_storage_helper.removeItem(storage_key)

    const metadata = await plays_view_browser_storage_load_metadata()
    if (metadata.view_access_times && metadata.view_access_times[view_id]) {
      delete metadata.view_access_times[view_id]
      local_storage_helper.setItem(
        PLAYS_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY,
        metadata
      )
    }
  } catch (error) {
    console.error('Error clearing browser storage view history:', error)
  }
}

export const plays_view_browser_storage_set_last_active_view = async (
  view_id
) => {
  try {
    const last_active = {
      view_id,
      timestamp: Date.now()
    }
    local_storage_helper.setItem(
      PLAYS_VIEW_BROWSER_STORAGE_CONFIG.LAST_ACTIVE_KEY,
      last_active
    )
  } catch (error) {
    console.error('Error setting last active view:', error)
  }
}

export const plays_view_browser_storage_get_last_active_view = async () => {
  try {
    const last_active = await local_storage_helper.getItem(
      PLAYS_VIEW_BROWSER_STORAGE_CONFIG.LAST_ACTIVE_KEY
    )
    return last_active || null
  } catch (error) {
    console.error('Error getting last active view:', error)
    return null
  }
}

export const plays_view_browser_storage_load_metadata = async () => {
  try {
    const metadata = await local_storage_helper.getItem(
      PLAYS_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY
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

const plays_view_browser_storage_update_metadata_for_view = async (
  view_id
) => {
  try {
    const metadata = await plays_view_browser_storage_load_metadata()
    if (!metadata.view_access_times) {
      metadata.view_access_times = {}
    }
    metadata.view_access_times[view_id] = Date.now()
    local_storage_helper.setItem(
      PLAYS_VIEW_BROWSER_STORAGE_CONFIG.METADATA_KEY,
      metadata
    )
  } catch (error) {
    console.error('Error updating metadata for view:', error)
  }
}

export const plays_view_browser_storage_get_all_view_ids = async () => {
  try {
    const metadata = await plays_view_browser_storage_load_metadata()
    return Object.keys(metadata.view_access_times || {})
  } catch (error) {
    console.error('Error getting all view IDs from browser storage:', error)
    return []
  }
}
