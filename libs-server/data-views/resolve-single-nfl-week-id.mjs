import { current_season } from '#constants'
import { format_nfl_week_identifier } from '#libs-shared/nfl-week-identifier.mjs'

// Resolves a `{dynamic_type: 'current_nfl_week'}` param object to a concrete
// identifier. The `single_nfl_week_id` param in common-column-params defines
// this as its default_value, so views that never pinned a specific week
// arrive here with the raw dynamic object.
const resolve_dynamic_single_nfl_week = (value) => {
  if (value && typeof value === 'object' && value.dynamic_type) {
    if (value.dynamic_type === 'current_nfl_week') {
      return format_nfl_week_identifier({
        year: current_season.year,
        seas_type: 'REG',
        week: Math.max(current_season.week, 1)
      })
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
 *   3. Construct from params.year + params.week + params.seas_type (defaults REG)
 *
 * Returns a scalar identifier string (e.g. "2024_REG_WEEK_5") or null.
 */
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
    return format_nfl_week_identifier({
      year,
      seas_type: seas_type_param || 'REG',
      week
    })
  }
  return null
}
