import { nfl_plays_column_params } from '#libs-shared'

export default function get_stats_column_param_key({
  params = {},
  additional_keys = []
} = {}) {
  const column_param_keys = Object.keys(nfl_plays_column_params).sort()
  const all_keys = [...column_param_keys, ...additional_keys].sort()
  const key = all_keys
    .map((key) => {
      const value = params[key]
      return Array.isArray(value)
        ? `${key}${value.sort().join('')}`
        : `${key}${value || ''}`
    })
    .join('')

  return key
}
