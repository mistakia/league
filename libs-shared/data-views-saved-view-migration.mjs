import { translate_rate_type_to_output } from './data-views-output-tokens.mjs'

const TEAM_FROM_PLAYS_RE = /^team_(.+)_from_plays$/

const migrate_params = (params) => {
  let next = params
  let changed = false

  if (next.rate_type != null && next.output == null) {
    const token = Array.isArray(next.rate_type) ? next.rate_type[0] : null
    const translated = token ? translate_rate_type_to_output(token) : null
    if (translated) {
      next = { ...next, output: translated }
      changed = true
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'rate_type')) {
    const { rate_type: _drop, ...rest } = next
    next = rest
    changed = true
  }

  if (Object.prototype.hasOwnProperty.call(next, 'rate_type_match_column_params')) {
    const { rate_type_match_column_params: value, ...rest } = next
    next = { ...rest, output_match_column_params: value }
    changed = true
  }
  if (Object.prototype.hasOwnProperty.call(next, 'rate_type_column_params')) {
    const { rate_type_column_params: value, ...rest } = next
    next = { ...rest, output_column_params: value }
    changed = true
  }

  return { params: next, changed }
}

export const migrate_column_entry = ({ column_id, params }) => {
  const entry = migrate_params(params || {})
  let next_column_id = column_id
  let next_params = entry.params
  let changed = entry.changed

  const team_match = TEAM_FROM_PLAYS_RE.exec(column_id)
  if (team_match && next_params.limit_to_player_active_games) {
    next_column_id = `player_team_${team_match[1]}_from_plays`
    const { limit_to_player_active_games: _drop, ...rest } = next_params
    next_params = rest
    changed = true
  }

  return { column_id: next_column_id, params: next_params, changed }
}

// Walks an entries array, collecting any column_id renames into `rename_map`
// so sort entries (which carry only column_id) can follow the rename.
const migrate_entries_array = ({ entries, rename_map }) => {
  if (!Array.isArray(entries)) return { entries, changed: false }
  let changed = false
  const next = entries.map((entry) => {
    if (typeof entry === 'string') {
      const migrated = migrate_column_entry({ column_id: entry, params: {} })
      if (migrated.column_id !== entry) {
        changed = true
        rename_map.set(entry, migrated.column_id)
        return Object.keys(migrated.params).length > 0
          ? { column_id: migrated.column_id, params: migrated.params }
          : migrated.column_id
      }
      return entry
    }
    if (!entry || typeof entry !== 'object' || !entry.column_id) return entry
    const migrated = migrate_column_entry({
      column_id: entry.column_id,
      params: entry.params || {}
    })
    if (migrated.column_id !== entry.column_id) {
      rename_map.set(entry.column_id, migrated.column_id)
    }
    if (migrated.changed) {
      changed = true
      return { ...entry, column_id: migrated.column_id, params: migrated.params }
    }
    return entry
  })
  return { entries: next, changed }
}

const apply_rename_to_sort = ({ sort, rename_map }) => {
  if (!Array.isArray(sort) || rename_map.size === 0) {
    return { sort, changed: false }
  }
  let changed = false
  const next = sort.map((entry) => {
    if (!entry || typeof entry !== 'object' || !entry.column_id) return entry
    const renamed = rename_map.get(entry.column_id)
    if (renamed && renamed !== entry.column_id) {
      changed = true
      return { ...entry, column_id: renamed }
    }
    return entry
  })
  return { sort: next, changed }
}

export const migrate_table_state = (table_state) => {
  if (!table_state || typeof table_state !== 'object') {
    return { changed: false, table_state }
  }
  let changed = false
  const next = { ...table_state }
  const rename_map = new Map()

  const columns_result = migrate_entries_array({
    entries: table_state.columns,
    rename_map
  })
  if (columns_result.changed) {
    next.columns = columns_result.entries
    changed = true
  }

  const prefix_result = migrate_entries_array({
    entries: table_state.prefix_columns,
    rename_map
  })
  if (prefix_result.changed) {
    next.prefix_columns = prefix_result.entries
    changed = true
  }

  const where_result = migrate_entries_array({
    entries: table_state.where,
    rename_map
  })
  if (where_result.changed) {
    next.where = where_result.entries
    changed = true
  }

  const sort_result = apply_rename_to_sort({
    sort: table_state.sort,
    rename_map
  })
  if (sort_result.changed) {
    next.sort = sort_result.sort
    changed = true
  }

  if (!Array.isArray(table_state.subjects) || table_state.subjects.length === 0) {
    next.subjects = ['player']
    changed = true
  }

  return { changed, table_state: next }
}
