import { nfl_plays_column_params, serialize_preset_value } from '#libs-shared'

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
        const parts = value
          .map((v) => {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              return serialize_preset_value(v)
            }
            return String(v)
          })
          .sort()
        return `${key}${parts.join('|')}`
      } else if (value !== undefined && value !== null) {
        return `${key}${value}`
      } else {
        return `${key}`
      }
    })
    .join('')

  return key
}
