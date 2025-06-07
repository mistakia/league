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
      if (Array.isArray(value)) {
        return `${key}${value.sort().join('')}`
      } else if (value !== undefined && value !== null) {
        return `${key}${value}`
      } else {
        return `${key}`
      }
    })
    .join('')

  return key
}
