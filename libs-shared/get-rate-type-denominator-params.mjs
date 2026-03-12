import nfl_plays_column_params from './nfl-plays-column-params.mjs'
import { COLUMN_PARAM_GROUPS } from './column-param-groups.mjs'

const TIME_SCOPE_PARAM_KEYS = new Set([
  'career_year',
  'career_game',
  'year',
  'year_offset',
  'week',
  'week_offset',
  'seas_type'
])

const NON_PLAY_LEVEL_GROUPS = new Set([
  COLUMN_PARAM_GROUPS.GAME,
  COLUMN_PARAM_GROUPS.WEATHER,
  COLUMN_PARAM_GROUPS.BETTING_MARKETS,
  COLUMN_PARAM_GROUPS.PACE,
  COLUMN_PARAM_GROUPS.PLAY_TIMEOUT
])

const play_level_param_keys = new Set()

for (const [key, param_def] of Object.entries(nfl_plays_column_params)) {
  if (TIME_SCOPE_PARAM_KEYS.has(key)) {
    continue
  }

  const groups = param_def.groups || []
  const is_non_play_level =
    groups.length > 0 && groups.every((g) => NON_PLAY_LEVEL_GROUPS.has(g))

  if (!is_non_play_level) {
    play_level_param_keys.add(key)
  }
}

export { play_level_param_keys }

export function get_play_level_params_hash_suffix({
  params,
  rate_type_params = {}
} = {}) {
  const denominator_params = get_rate_type_denominator_params({ params })
  return Object.entries(denominator_params)
    .filter(
      ([key]) => play_level_param_keys.has(key) && !(key in rate_type_params)
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `_${key}_${JSON.stringify(value)}`)
    .join('')
}

export default function get_rate_type_denominator_params({ params = {} } = {}) {
  const result = {}

  // Always include time/scope params
  for (const key of TIME_SCOPE_PARAM_KEYS) {
    if (params[key] !== undefined) {
      result[key] = params[key]
    }
  }

  if (params.rate_type_column_params) {
    // Use denominator-specific play-level param overrides
    for (const [key, value] of Object.entries(params.rate_type_column_params)) {
      if (play_level_param_keys.has(key)) {
        result[key] = value
      }
    }
  }
  // When rate_type_column_params is absent (backwards compatible), no play-level params are included

  return result
}
