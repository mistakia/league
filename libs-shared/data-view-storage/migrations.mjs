// Versioned migration registry for data-view snapshots stored in browser
// localStorage. Breaking table_state changes MUST bump STORAGE_SCHEMA_VERSION
// and add a new v{N-1}->v{N} entry to the migrations array below. See
// user:text/league/data-view-storage-architecture.md for the full contract.

import { migrate_table_state } from './../data-views-nfl-week-migration.mjs'
import { migrate_table_state as migrate_saved_view_table_state } from './../data-views-saved-view-migration.mjs'
import { migrate_table_state as migrate_row_grain_table_state } from './../data-views-row-grain-migration.mjs'

export const STORAGE_SCHEMA_VERSION = 3

const is_dev =
  typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'

const deep_freeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const key of Object.keys(value)) deep_freeze(value[key])
  return Object.freeze(value)
}

const v0_to_v1 = (snapshot) => {
  const { table_state: next_table_state } = migrate_table_state(
    snapshot.table_state
  )
  return { ...snapshot, table_state: next_table_state, version: 1 }
}

const v1_to_v2 = (snapshot) => {
  const { table_state: next_table_state } = migrate_saved_view_table_state(
    snapshot.table_state
  )
  return { ...snapshot, table_state: next_table_state, version: 2 }
}

const v2_to_v3 = (snapshot) => {
  const { table_state: next_table_state } = migrate_row_grain_table_state(
    snapshot.table_state
  )
  return { ...snapshot, table_state: next_table_state, version: 3 }
}

export const migrations = [
  { from: 0, to: 1, migrate: v0_to_v1 },
  { from: 1, to: 2, migrate: v1_to_v2 },
  { from: 2, to: 3, migrate: v2_to_v3 }
]

export const run_migrations = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return { snapshot, migrated: false }
  }
  let current = snapshot
  let current_version = current.version ?? 0
  let migrated = false
  while (current_version < STORAGE_SCHEMA_VERSION) {
    const entry = migrations.find((m) => m.from === current_version)
    if (!entry) break
    const input = is_dev ? deep_freeze(current) : current
    current = entry.migrate(input)
    current_version = entry.to
    migrated = true
  }
  return { snapshot: current, migrated }
}
