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
  player_average_ranking: {
    season: 'player_season_average_ranking',
    week: 'player_week_average_ranking'
  },
  player_overall_ranking: {
    season: 'player_season_overall_ranking',
    week: 'player_week_overall_ranking'
  },
  player_position_ranking: {
    season: 'player_season_position_ranking',
    week: 'player_week_position_ranking'
  },
  player_min_ranking: {
    season: 'player_season_min_ranking',
    week: 'player_week_min_ranking'
  },
  player_max_ranking: {
    season: 'player_season_max_ranking',
    week: 'player_week_max_ranking'
  },
  player_ranking_standard_deviation: {
    season: 'player_season_ranking_standard_deviation',
    week: 'player_week_ranking_standard_deviation'
  }
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
        out.push(format_nfl_week_identifier({ year: y, seas_type: st, week: w }))
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

  // Ranking rename: must run before param consolidation since old name gates behavior
  if (Object.prototype.hasOwnProperty.call(RANKING_NAMES_MAP, column_id)) {
    const mapping = RANKING_NAMES_MAP[column_id]
    const week_val = as_array(params.week)[0]
    const is_season = week_val == null || Number(week_val) === 0
    if (is_season) {
      column_id = mapping.season
      delete params.week
      delete params.seas_type
      delete params.single_week
      delete params.single_seas_type
    } else {
      column_id = mapping.week
      const identifier = resolve_single_identifier(params)
      if (identifier) params.single_nfl_week_id = [identifier]
      clean_legacy(params)
    }
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
