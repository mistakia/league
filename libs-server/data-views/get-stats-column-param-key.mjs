import { nfl_plays_column_params, serialize_preset_value } from '#libs-shared'

// Scope params that narrow the emitted CTE but are not members of
// nfl_plays_column_params. year / week / seas_type were registry members until
// 64a28f9dc replaced them with the composite nfl_week_id, and this key derives
// its membership from that registry -- so it lost year and seas_type silently,
// in a commit that never touched this file. The consequence was a wrong answer
// rather than an error: two *_from_plays columns differing only by year hashed
// identically, landed in one join group, and shared one CTE built from
// whichever column seeded the group, so the second rendered the first's values
// under its own header.
//
// Emitted only when the param is present, so a column declaring no time scope
// keeps the hash it had before -- the alias changes only for the configurations
// that were broken.
//
// `week` is deliberately absent. Nothing on the from-plays path reads
// params.week (nfl_week_id is the canonical week param and is already a
// registry member), so two columns differing only by week genuinely resolve to
// the same query; keying on it would mint distinct CTEs with identical SQL.
const scope_param_keys = ['year', 'seas_type']

const has_value = (value) => {
  if (value === undefined || value === null) return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

const serialize_param = ({ key, value }) => {
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
}

export default function get_stats_column_param_key({
  params = {},
  additional_keys = []
} = {}) {
  const column_param_keys = Object.keys(nfl_plays_column_params).sort()
  const all_keys = [...column_param_keys, ...additional_keys].sort()
  const key = all_keys
    .map((key) => serialize_param({ key, value: params[key] }))
    .join('')

  const scope_key = scope_param_keys
    .filter((key) => has_value(params[key]))
    .map((key) => serialize_param({ key, value: params[key] }))
    .join('')

  return `${key}${scope_key}`
}
