/* global localStorage */

import { is_valid_table_state, is_empty_new_view } from './validate.mjs'
import { STORAGE_SCHEMA_VERSION, run_migrations } from './migrations.mjs'

const STORAGE_KEY_PREFIX = 'data_view_history_'
const METADATA_KEY = 'data_view_metadata'
const LAST_ACTIVE_KEY = 'data_view_last_active'

export const MAX_SNAPSHOTS_PER_VIEW = 20
export const MAX_VIEWS_CACHED = 50
export const SNAPSHOT_TTL_DAYS = 90
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
const SNAPSHOT_TTL_MS = SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000

const DEFAULT_VIEW_IDS = new Set([
  'SEASON_FANTASY_POINTS',
  'SEASON_PROJECTIONS',
  'PASSING_STATS_BY_PLAY',
  'RUSHING_STATS_BY_PLAY',
  'RECEIVING_STATS_BY_PLAY'
])

let on_quota_exceeded_cb = null

export const init_storage = ({ on_quota_exceeded } = {}) => {
  on_quota_exceeded_cb = on_quota_exceeded || null
}

const read_json = (key) => {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw)
  } catch (error) {
    console.error(`Failed to parse localStorage item "${key}":`, error)
    localStorage.removeItem(key)
    return null
  }
}

const write_json = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
}

const remove_key = (key) => {
  localStorage.removeItem(key)
}

const sanitize_params = (params) => {
  if (!params || typeof params !== 'object') return params
  const sanitized = {}
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      const flattened = value.flat(Infinity)
      sanitized[key] = flattened.filter(
        (v) => v !== undefined && v !== null && v !== ''
      )
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

const sanitize_column = (col) => {
  if (typeof col === 'string') return col
  return { ...col, params: sanitize_params(col.params) }
}

const sanitize_table_state = (table_state) => ({
  ...table_state,
  columns: table_state.columns.map(sanitize_column),
  prefix_columns: table_state.prefix_columns.map(sanitize_column),
  where: table_state.where?.map((clause) => ({
    ...clause,
    params: sanitize_params(clause.params)
  }))
})

const load_metadata = () => {
  const metadata = read_json(METADATA_KEY)
  return (
    metadata || {
      view_access_times: {},
      last_cleanup: null
    }
  )
}

const save_metadata = (metadata) => write_json(METADATA_KEY, metadata)

const storage_key_for = (view_id) => `${STORAGE_KEY_PREFIX}${view_id}`

const load_raw_history = (view_id) => {
  const history = read_json(storage_key_for(view_id))
  if (!Array.isArray(history)) return []
  return history
}

const with_quota_recovery = (view_id, write_fn) => {
  try {
    write_fn()
    return true
  } catch (error) {
    if (error?.name !== 'QuotaExceededError') {
      console.error('Error writing to browser storage:', error)
      return false
    }
    try {
      evict_lru_views()
      write_fn()
      return true
    } catch (retry_error) {
      console.error('Browser storage quota still exceeded after eviction:', retry_error)
      if (on_quota_exceeded_cb) {
        try {
          on_quota_exceeded_cb({ view_id })
        } catch (cb_error) {
          console.error('on_quota_exceeded callback threw:', cb_error)
        }
      }
      return false
    }
  }
}

const evict_lru_views = () => {
  const metadata = load_metadata()
  const view_ids = Object.keys(metadata.view_access_times || {})
  if (view_ids.length <= MAX_VIEWS_CACHED) return
  const sorted = view_ids.sort(
    (a, b) => metadata.view_access_times[a] - metadata.view_access_times[b]
  )
  const to_remove = sorted.slice(0, view_ids.length - MAX_VIEWS_CACHED)
  for (const view_id of to_remove) {
    remove_key(storage_key_for(view_id))
    delete metadata.view_access_times[view_id]
  }
  save_metadata(metadata)
}

const evict_ttl_expired = () => {
  const now = Date.now()
  const metadata = load_metadata()
  const view_ids = Object.keys(metadata.view_access_times || {})
  let changed = false
  for (const view_id of view_ids) {
    const history = load_raw_history(view_id)
    if (history.length === 0) {
      remove_key(storage_key_for(view_id))
      delete metadata.view_access_times[view_id]
      changed = true
      continue
    }
    const last = history[history.length - 1]
    const ts = last?.timestamp
    if (typeof ts === 'number' && now - ts > SNAPSHOT_TTL_MS) {
      remove_key(storage_key_for(view_id))
      delete metadata.view_access_times[view_id]
      changed = true
    }
  }
  if (changed) save_metadata(metadata)
}

const run_time_gated_cleanup = () => {
  const metadata = load_metadata()
  const now = Date.now()
  const last_cleanup = metadata.last_cleanup || 0
  if (now - last_cleanup <= CLEANUP_INTERVAL_MS) return
  evict_ttl_expired()
  evict_lru_views()
  const meta_after = load_metadata()
  meta_after.last_cleanup = now
  save_metadata(meta_after)
}

const touch_view_access = (view_id) => {
  const metadata = load_metadata()
  if (!metadata.view_access_times) metadata.view_access_times = {}
  metadata.view_access_times[view_id] = Date.now()
  save_metadata(metadata)
}

export const save_snapshot = ({ view_id, table_state, change_type, is_new_view }) => {
  if (!view_id) return false
  if (DEFAULT_VIEW_IDS.has(view_id)) return false
  if (!is_valid_table_state(table_state)) return false
  if (is_new_view && is_empty_new_view(table_state)) return false

  const snapshot = {
    version: STORAGE_SCHEMA_VERSION,
    timestamp: Date.now(),
    change_type,
    table_state: sanitize_table_state(table_state)
  }
  const key = storage_key_for(view_id)

  const ok = with_quota_recovery(view_id, () => {
    let history = load_raw_history(view_id)
    history.push(snapshot)
    if (history.length > MAX_SNAPSHOTS_PER_VIEW) {
      history = history.slice(-MAX_SNAPSHOTS_PER_VIEW)
    }
    write_json(key, history)
  })

  if (!ok) return false
  touch_view_access(view_id)
  run_time_gated_cleanup()
  return true
}

export const load_latest_snapshot = (view_id) => {
  const history = load_raw_history(view_id)
  if (history.length === 0) return null
  const last = history[history.length - 1]
  if (!last || !is_valid_table_state(last.table_state)) return null
  const { snapshot, migrated } = run_migrations(last)
  if (migrated) {
    const next_history = history.slice(0, -1).concat([snapshot])
    with_quota_recovery(view_id, () => write_json(storage_key_for(view_id), next_history))
  }
  return snapshot
}

export const load_history = (view_id) => {
  const history = load_raw_history(view_id)
  if (history.length === 0) return []
  const migrated_entries = []
  let any_changed = false
  for (const entry of history) {
    if (!entry || !is_valid_table_state(entry.table_state)) {
      any_changed = true
      continue
    }
    const { snapshot, migrated } = run_migrations(entry)
    if (migrated) any_changed = true
    migrated_entries.push(snapshot)
  }
  if (migrated_entries.length === 0) {
    clear_view(view_id)
    return []
  }
  if (any_changed) {
    with_quota_recovery(view_id, () =>
      write_json(storage_key_for(view_id), migrated_entries)
    )
  }
  return migrated_entries
}

export const clear_view = (view_id) => {
  remove_key(storage_key_for(view_id))
  const metadata = load_metadata()
  if (metadata.view_access_times && metadata.view_access_times[view_id]) {
    delete metadata.view_access_times[view_id]
    save_metadata(metadata)
  }
}

export const clear_all = () => {
  const metadata = load_metadata()
  const view_ids = Object.keys(metadata.view_access_times || {})
  for (const view_id of view_ids) {
    remove_key(storage_key_for(view_id))
  }
  remove_key(METADATA_KEY)
  remove_key(LAST_ACTIVE_KEY)
}

export const reconcile_server_views = ({ server_view_ids, redux_view_ids }) => {
  const server_set = new Set(server_view_ids || [])
  const redux_set = new Set(redux_view_ids || [])
  const metadata = load_metadata()
  const view_ids = Object.keys(metadata.view_access_times || {})
  let changed = false
  for (const view_id of view_ids) {
    if (DEFAULT_VIEW_IDS.has(view_id)) continue
    if (server_set.has(view_id)) continue
    if (redux_set.has(view_id)) continue
    remove_key(storage_key_for(view_id))
    delete metadata.view_access_times[view_id]
    changed = true
  }
  if (changed) save_metadata(metadata)
}

export const save_last_active_view = (view_id) => {
  write_json(LAST_ACTIVE_KEY, { view_id, timestamp: Date.now() })
}

export const load_last_active_view = () => read_json(LAST_ACTIVE_KEY)

export const get_all_stored_view_ids = () => {
  const metadata = load_metadata()
  return Object.keys(metadata.view_access_times || {})
}
