import { format_nfl_week_identifier } from './nfl-week-identifier.mjs'

export const SINGLE_WEEK_COLUMNS = new Set([
  'player_dfs_salary',
  'player_dfs_ownership_pct',
  'player_practice_status',
  'player_practice_injury',
  'player_practice_game_designation',
  'player_practice_roster_status',
  'player_practice_designation_monday',
  'player_practice_designation_tuesday',
  'player_practice_designation_wednesday',
  'player_practice_designation_thursday',
  'player_practice_designation_friday',
  'player_practice_designation_saturday',
  'player_practice_designation_sunday',
  'player_week_projected_market_salary',
  'player_league_roster_status',
  'player_game_prop_line_from_betting_markets',
  'player_game_prop_american_odds_from_betting_markets',
  'player_game_prop_decimal_odds_from_betting_markets',
  'player_game_prop_implied_probability_from_betting_markets',
  'player_game_prop_historical_hit_rate',
  'player_game_prop_historical_edge',
  'team_game_prop_line_from_betting_markets',
  'team_game_prop_american_odds_from_betting_markets',
  'team_game_prop_decimal_odds_from_betting_markets',
  'team_game_implied_team_total_from_betting_markets'
])

export const MULTI_WEEK_COLUMNS = new Set([
  'player_games_played',
  'player_nfl_teams'
])

export const RANKING_NAMES_MAP = {
  player_average_ranking: 'player_season_average_ranking',
  player_overall_ranking: 'player_season_overall_ranking',
  player_position_ranking: 'player_season_position_ranking',
  player_min_ranking: 'player_season_min_ranking',
  player_max_ranking: 'player_season_max_ranking',
  player_ranking_standard_deviation:
    'player_season_ranking_standard_deviation'
}

const as_array = (v) => (Array.isArray(v) ? v : v == null ? [] : [v])

// Dynamic-value objects (e.g. `{dynamic_type: 'current_nfl_week'}`) are the
// default_value for single_nfl_week_id. For migration purposes, treat them as
// absent so the default reapplies at query time rather than freezing the
// current week into the stored view.
const is_static_identifier = (v) => typeof v === 'string' && v.length > 0

const resolve_single_identifier = (params = {}) => {
  const single = as_array(params.single_nfl_week_id).find(is_static_identifier)
  if (single) return single
  const multi = as_array(params.nfl_week_id).find(is_static_identifier)
  if (multi) return multi
  const year = as_array(params.year)[0]
  const week = as_array(params.week)[0]
  const seas_type = as_array(params.seas_type)[0] || 'REG'
  if (year != null && week != null) {
    return format_nfl_week_identifier({ year, seas_type, week })
  }
  return null
}

const resolve_multi_identifiers = (params = {}) => {
  const existing = as_array(params.nfl_week_id).filter((v) => v != null)
  if (existing.length) return existing
  const years = as_array(params.year)
  const weeks = as_array(params.week)
  const seas_types = as_array(params.seas_type)
  const types = seas_types.length ? seas_types : ['REG']
  const out = []
  for (const y of years) {
    for (const w of weeks) {
      for (const st of types) {
        out.push(
          format_nfl_week_identifier({ year: y, seas_type: st, week: w })
        )
      }
    }
  }
  return out
}

const clean_legacy = (params) => {
  delete params.year
  delete params.week
  delete params.seas_type
  delete params.single_week
  delete params.single_seas_type
}

/**
 * Migrate a single column entry's (column_id, params) for single_nfl_week_id migration.
 * Returns { column_id, params }. Non-target columns returned unchanged.
 */
export const migrate_column_entry = ({ column_id, params }) => {
  params = params ? { ...params } : {}

  // Ranking rename: rankings are season-only; always emit the season variant
  if (Object.prototype.hasOwnProperty.call(RANKING_NAMES_MAP, column_id)) {
    column_id = RANKING_NAMES_MAP[column_id]
    delete params.week
    delete params.seas_type
    delete params.single_week
    delete params.single_seas_type
    delete params.single_nfl_week_id
    delete params.nfl_week_id
    return { column_id, params }
  }

  if (SINGLE_WEEK_COLUMNS.has(column_id)) {
    const identifier = resolve_single_identifier(params)
    if (identifier) {
      params.single_nfl_week_id = [identifier]
    }
    delete params.nfl_week_id
    clean_legacy(params)
    return { column_id, params }
  }

  if (MULTI_WEEK_COLUMNS.has(column_id)) {
    const identifiers = resolve_multi_identifiers(params)
    if (identifiers.length) {
      params.nfl_week_id = identifiers
    }
    clean_legacy(params)
    return { column_id, params }
  }

  return { column_id, params }
}

/**
 * Apply `migrate_column_entry` to an array of column descriptors.
 * Handles both string ids and `{column_id, params}` objects, preserving
 * non-column fields (e.g. operator/value on where-clauses).
 */
export const migrate_entries_array = (entries) => {
  if (!Array.isArray(entries)) return entries
  return entries.map((entry) => {
    if (typeof entry === 'string') {
      return migrate_column_entry({ column_id: entry, params: {} }).column_id
    }
    if (!entry || !entry.column_id) return entry
    const migrated = migrate_column_entry({
      column_id: entry.column_id,
      params: entry.params || {}
    })
    return { ...entry, column_id: migrated.column_id, params: migrated.params }
  })
}

/**
 * Rewrite sort-array column_ids that reference legacy ranking names.
 * Rankings are season-only, so any legacy id maps directly to its season
 * variant in `RANKING_NAMES_MAP`.
 */
export const migrate_sort_array = ({ sort }) => {
  if (!Array.isArray(sort)) return sort
  return sort.map((entry) => {
    if (!entry || typeof entry !== 'object' || !entry.column_id) return entry
    const new_id = RANKING_NAMES_MAP[entry.column_id]
    if (!new_id || new_id === entry.column_id) return entry
    return { ...entry, column_id: new_id }
  })
}

/**
 * Migrate a full table_state in one pass. Returns `{ changed, table_state }`
 * with new arrays for columns, prefix_columns, where, and sort.
 */
export const migrate_table_state = (table_state) => {
  if (!table_state || typeof table_state !== 'object') {
    return { changed: false, table_state }
  }
  const next = { ...table_state }
  let changed = false

  const migrate_list = (key) => {
    if (!Array.isArray(table_state[key])) return
    const migrated = migrate_entries_array(table_state[key])
    if (JSON.stringify(migrated) !== JSON.stringify(table_state[key])) {
      changed = true
      next[key] = migrated
    } else {
      next[key] = table_state[key]
    }
  }

  migrate_list('columns')
  migrate_list('prefix_columns')
  migrate_list('where')

  if (Array.isArray(table_state.sort)) {
    const migrated_sort = migrate_sort_array({
      sort: table_state.sort,
      post_columns: next.columns,
      post_prefix_columns: next.prefix_columns
    })
    if (JSON.stringify(migrated_sort) !== JSON.stringify(table_state.sort)) {
      changed = true
      next.sort = migrated_sort
    }
  }

  return { changed, table_state: next }
}
