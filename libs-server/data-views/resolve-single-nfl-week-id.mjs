import {
  format_nfl_week_identifier,
  current_nfl_week_identifier,
  current_nfl_week_params,
  last_meaningful_reg_week_params_for_year
} from '#libs-shared/nfl-week-identifier.mjs'

// Resolves a `{dynamic_type: 'current_nfl_week'}` param object to a concrete
// identifier. The `single_nfl_week_id` param in common-column-params defines
// this as its default_value, so views that never pinned a specific week
// arrive here with the raw dynamic object.
const resolve_dynamic_single_nfl_week = (value) => {
  if (value && typeof value === 'object' && value.dynamic_type) {
    if (value.dynamic_type === 'current_nfl_week') {
      return current_nfl_week_identifier()
    }
    return null
  }
  return value
}

const first_scalar = (value) => {
  const candidate = Array.isArray(value) ? value[0] : value
  return resolve_dynamic_single_nfl_week(candidate)
}

/**
 * Resolves a scalar nfl_week_id value from params with legacy fallback.
 *
 * Precedence:
 *   1. params.single_nfl_week_id (scalar, one-element array, or dynamic object)
 *   2. params.nfl_week_id[0] (compat with saved views that set the multi param)
 *   3. Construct from params.year + params.week + params.seas_type
 *   4. Fall back to the current nfl_week identifier.
 */
const has_explicit_week_param = (params = {}) => {
  const single = params.single_nfl_week_id
  if (single != null && !(Array.isArray(single) && single.length === 0)) {
    return true
  }
  const multi = params.nfl_week_id
  if (multi != null && !(Array.isArray(multi) && multi.length === 0)) {
    return true
  }
  return false
}

// Resolves only when the caller explicitly set `single_nfl_week_id` or
// `nfl_week_id`. Returns null otherwise, so season-level callers can skip
// attaching week-scoped joins.
export function resolve_single_nfl_week_id_if_explicit({ params = {} } = {}) {
  if (!has_explicit_week_param(params)) return null
  return resolve_single_nfl_week_id({ params })
}

export default function resolve_single_nfl_week_id({ params = {} } = {}) {
  const single_value = first_scalar(params.single_nfl_week_id)
  if (single_value) return single_value

  const multi_value = first_scalar(params.nfl_week_id)
  if (multi_value) return multi_value

  const year = Array.isArray(params.year) ? params.year[0] : params.year
  const week = Array.isArray(params.week) ? params.week[0] : params.week
  const seas_type_param = Array.isArray(params.seas_type)
    ? params.seas_type[0]
    : params.seas_type
  if (year != null && week != null) {
    let seas_type
    if (seas_type_param) {
      seas_type = seas_type_param
    } else {
      const current = current_nfl_week_params()
      if (year === current.year && week === current.week) {
        seas_type = current.seas_type
      } else {
        seas_type = 'REG'
      }
    }
    return format_nfl_week_identifier({ year, seas_type, week })
  }
  // Year-only intent: honor the saved view's year rather than silently
  // returning the live current week.
  if (year != null) {
    const year_params = last_meaningful_reg_week_params_for_year({ year })
    if (year_params) return format_nfl_week_identifier(year_params)
  }
  return current_nfl_week_identifier()
}
