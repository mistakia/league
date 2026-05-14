import {
  get_nfl_week_identifiers_for_year,
  current_nfl_week_identifier,
  nfl_week_offset_params,
  format_nfl_week_identifier
} from '@libs-shared/nfl-week-identifier.mjs'
import { current_season } from '@constants'

const summarize_year_seas_set = (values) => {
  const years = new Set()
  const seas_types = new Set()
  for (const v of values) {
    const m = /^(\d{4})_([A-Z]+)_/.exec(v)
    if (!m) return null
    years.add(parseInt(m[1], 10))
    seas_types.add(m[2])
  }
  if (!years.size) return null
  const sorted = [...years].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const range = min === max ? `${min}` : `${min}-${max}`
  return `${range} ${[...seas_types].join('/')}`
}

const format_resolved_values = (key, values) => {
  if (!values.length) return ''
  if (key === 'nfl_week_id') {
    return summarize_year_seas_set(values) || ''
  }
  const preview = values.slice(0, 4).join(', ')
  return values.length > 4 ? `${preview}, +${values.length - 4} more` : preview
}

const resolve_dynamic_nfl_week_id = (dv) => {
  switch (dv.dynamic_type) {
    case 'current_year_reg_weeks':
      return get_nfl_week_identifiers_for_year({
        year: current_season.stats_season_year,
        seas_type: 'REG'
      })
    case 'current_nfl_week':
      return [current_nfl_week_identifier()]
    case 'last_n_nfl_weeks': {
      const n = parseInt(dv.value || 5, 10)
      const result = []
      for (let i = 0; i < n; i++) {
        const params = nfl_week_offset_params({ offset: -i })
        if (!params) break
        result.push(format_nfl_week_identifier(params))
      }
      return result
    }
    case 'last_n_nfl_years': {
      const n = parseInt(dv.value || 3, 10)
      const result = []
      for (let i = 0; i < n; i++) {
        const y = current_season.stats_season_year - i
        if (y < 2000) break
        result.push(...get_nfl_week_identifiers_for_year({ year: y }))
      }
      return result
    }
    default:
      return null
  }
}

const resolve_param_values = (key, value) => {
  const list = Array.isArray(value) ? value : [value]
  const resolved = []
  for (const v of list) {
    if (v && typeof v === 'object' && v.dynamic_type) {
      if (key !== 'nfl_week_id') return null
      const r = resolve_dynamic_nfl_week_id(v)
      if (!r) return null
      resolved.push(...r)
      continue
    }
    resolved.push(v)
  }
  return resolved
}

const find_filter_param_key_absent_from_columns = ({ where, columns }) => {
  const column_param_keys = new Set()
  for (const col of columns) {
    if (col && typeof col === 'object' && col.params) {
      for (const k of Object.keys(col.params)) column_param_keys.add(k)
    }
  }
  const notices = []
  for (let filter_index = 0; filter_index < where.length; filter_index++) {
    const filter = where[filter_index]
    const params = filter?.params || {}
    for (const key of Object.keys(params)) {
      if (!column_param_keys.has(key)) {
        const filter_value_preview = format_resolved_values(
          key,
          resolve_param_values(key, params[key]) || []
        )
        const scope_part = filter_value_preview
          ? ` (${filter_value_preview})`
          : ''
        notices.push({
          code: 'filter_param_key_absent_from_columns',
          severity: 'info',
          filter_index,
          message: `Filter scopes by "${key}"${scope_part}, but no displayed column shares this scope. Column values may include data outside the filter's scope.`
        })
      }
    }
  }
  return notices
}

const find_filter_param_value_disjoint_from_columns = ({ where, columns }) => {
  const notices = []
  for (let filter_index = 0; filter_index < where.length; filter_index++) {
    const filter = where[filter_index]
    const filter_params = filter?.params || {}
    for (const [key, filter_value] of Object.entries(filter_params)) {
      const resolved_filter = resolve_param_values(key, filter_value)
      if (!resolved_filter || resolved_filter.length === 0) continue

      let any_column_carries_key = false
      let any_overlap = false
      let any_column_dynamic = false
      const column_value_union = new Set()

      for (const col of columns) {
        if (!col || typeof col !== 'object' || !col.params) continue
        if (!(key in col.params)) continue
        any_column_carries_key = true
        const resolved_col = resolve_param_values(key, col.params[key])
        if (!resolved_col) {
          any_column_dynamic = true
          continue
        }
        for (const v of resolved_col) column_value_union.add(v)
        const col_set = new Set(resolved_col)
        if (resolved_filter.some((v) => col_set.has(v))) {
          any_overlap = true
          break
        }
      }

      if (any_column_carries_key && !any_overlap && !any_column_dynamic) {
        const filter_scope = format_resolved_values(key, resolved_filter)
        const column_scope = format_resolved_values(key, [
          ...column_value_union
        ])
        notices.push({
          code: 'filter_param_value_disjoint_from_columns',
          severity: 'info',
          filter_index,
          message: `Filter scopes "${key}" to ${filter_scope}, but columns carry ${column_scope}. Scopes do not overlap; results may be unexpected.`
        })
      }
    }
  }
  return notices
}

export default function get_data_view_notices({ where, columns }) {
  if (!Array.isArray(where) || !Array.isArray(columns)) return []
  return [
    ...find_filter_param_key_absent_from_columns({ where, columns }),
    ...find_filter_param_value_disjoint_from_columns({ where, columns })
  ]
}
