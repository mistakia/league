import {
  available_years,
  current_season,
  nfl_weeks,
  fantasy_positions,
  nfl_season_types
} from '#constants'
import * as table_constants from 'react-table/src/constants.mjs'
import {
  get_all_nfl_week_identifiers,
  format_nfl_week_param_values,
  current_nfl_week_params,
  nfl_week_offset_params,
  format_nfl_week_identifier
} from './nfl-week-identifier.mjs'

const format_year_value = ({ value, def }) => {
  const param_values = Array.isArray(value) ? value : [value]
  const parts = param_values.map((v) => {
    if (v && typeof v === 'object' && v.dynamic_type) {
      const dynamic_def = def?.dynamic_values?.find(
        (d) => d.dynamic_type === v.dynamic_type
      )
      const fallback =
        (dynamic_def?.label || v.dynamic_type) +
        (v.value != null ? ` (${v.value})` : '')
      const n = parseInt(v.value ?? dynamic_def?.default_value ?? 3, 10)
      const current = current_season.stats_season_year
      switch (v.dynamic_type) {
        case 'last_n_years': {
          const end = current
          const start = Math.max(2000, end - n + 1)
          return start === end ? `${end}` : `${start}-${end}`
        }
        case 'next_n_years': {
          const start = current + 1
          const end = current + n
          return start === end ? `${end}` : `${start}-${end}`
        }
        default:
          return fallback
      }
    }
    return String(v)
  })
  return parts.join(', ')
}

const format_week_value = ({ value, def }) => {
  const param_values = Array.isArray(value) ? value : [value]
  const parts = param_values.map((v) => {
    if (v && typeof v === 'object' && v.dynamic_type) {
      const dynamic_def = def?.dynamic_values?.find(
        (d) => d.dynamic_type === v.dynamic_type
      )
      const fallback =
        (dynamic_def?.label || v.dynamic_type) +
        (v.value != null ? ` (${v.value})` : '')
      const n = parseInt(v.value ?? dynamic_def?.default_value ?? 3, 10)
      const current = current_season.week
      switch (v.dynamic_type) {
        case 'current_week':
          return `${current}`
        case 'last_n_weeks': {
          const end = current
          const start = Math.max(1, end - n + 1)
          return start === end ? `${end}` : `${start}-${end}`
        }
        case 'next_n_weeks': {
          const start = current + 1
          const end = current + n
          return start === end ? `${end}` : `${start}-${end}`
        }
        default:
          return fallback
      }
    }
    return String(v)
  })
  return parts.join(', ')
}

export const career_year = {
  data_type: table_constants.TABLE_DATA_TYPES.RANGE,
  label: 'Career Year',
  show_key_in_short: true,
  min: 1,
  max: 25,
  preset_values: [
    {
      label: 'First/Rookie Year',
      values: [1, 1]
    },
    {
      label: 'Second/Sophomore Year',
      values: [2, 2]
    },
    {
      label: 'Third/Junior Year',
      values: [3, 3]
    },
    {
      label: 'First Two Years',
      values: [1, 2]
    },
    {
      label: 'First Three Years',
      values: [1, 3]
    }
  ]
}

export const career_game = {
  data_type: table_constants.TABLE_DATA_TYPES.RANGE,
  label: 'Career Game',
  show_key_in_short: true,
  min: 1,
  max: 500,
  preset_values: [
    {
      label: 'First Game',
      values: [1, 1]
    },
    {
      label: 'First 10 Games',
      values: [1, 10]
    },
    {
      label: 'First 25 Games',
      values: [1, 25]
    }
  ]
}

export const year = {
  values: available_years,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: current_season.stats_season_year,
  format_value: format_year_value,
  dynamic_values: [
    {
      dynamic_type: 'last_n_years',
      label: 'Last N Years',
      default_value: 3,
      has_value_field: true
    },
    {
      dynamic_type: 'next_n_years',
      label: 'Next N Years',
      default_value: 3,
      has_value_field: true
    }
  ]
}

export const single_year = {
  values: available_years,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  default_value: current_season.stats_season_year,
  enable_multi_on_split: ['year']
}

export const week = {
  values: nfl_weeks,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  format_value: format_week_value,
  dynamic_values: [
    {
      dynamic_type: 'last_n_weeks',
      label: 'Last N Weeks',
      default_value: 3,
      has_value_field: true
    },
    {
      dynamic_type: 'next_n_weeks',
      label: 'Next N Weeks',
      default_value: 3,
      has_value_field: true
    },
    {
      dynamic_type: 'current_week',
      label: 'Current Week'
    }
  ]
}

export const single_week = {
  values: nfl_weeks,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  default_value: Math.max(current_season.week, 1),
  enable_multi_on_split: ['week'],
  format_value: format_week_value,
  dynamic_values: [
    {
      dynamic_type: 'current_week',
      label: 'Current Week'
    }
  ]
}

export const year_offset = {
  data_type: table_constants.TABLE_DATA_TYPES.RANGE,
  label: 'Year + N',
  min: -30,
  max: 30,
  show_key_in_short: true,
  enable_on_splits: ['year']
}

export const single_year_offset = {
  data_type: table_constants.TABLE_DATA_TYPES.RANGE,
  label: 'Year + N',
  min: -30,
  max: 30,
  default_value: 0,
  is_single: true,
  show_key_in_short: true,
  enable_on_splits: ['year']
}

export const single_position = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  values: fantasy_positions,
  default_value: 'QB'
}

export const seas_type = {
  values: nfl_season_types,
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: 'REG'
}

export const single_seas_type = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  values: nfl_season_types,
  default_value: 'REG'
}

const resolve_nfl_week_dynamic = ({ dv, def }) => {
  const dynamic_def = def?.dynamic_values?.find(
    (d) => d.dynamic_type === dv.dynamic_type
  )
  const fallback =
    (dynamic_def?.label || dv.dynamic_type) +
    (dv.value != null ? ` (${dv.value})` : '')

  switch (dv.dynamic_type) {
    case 'current_year_reg_weeks':
      return `${current_season.stats_season_year} REG`
    case 'current_nfl_week': {
      const params = current_nfl_week_params()
      if (!params) return fallback
      return format_nfl_week_param_values({
        nfl_weeks: [format_nfl_week_identifier(params)]
      })
    }
    case 'last_n_nfl_weeks': {
      const n = parseInt(dv.value ?? dynamic_def?.default_value ?? 5, 10)
      const ids = []
      for (let i = 0; i < n; i++) {
        const params = nfl_week_offset_params({ offset: -i })
        if (!params) break
        ids.push(format_nfl_week_identifier(params))
      }
      return ids.length
        ? format_nfl_week_param_values({ nfl_weeks: ids })
        : fallback
    }
    case 'last_n_nfl_years': {
      const n = parseInt(dv.value ?? dynamic_def?.default_value ?? 3, 10)
      const end = current_season.year
      const start = Math.max(2000, end - n + 1)
      return start === end ? `${end}` : `${start}-${end}`
    }
    default:
      return fallback
  }
}

const format_nfl_week_id_value = ({ value, def }) => {
  const param_values = Array.isArray(value) ? value : [value]
  const static_values = param_values.filter((v) => typeof v === 'string')
  const dynamic_values = param_values.filter(
    (v) => v && typeof v === 'object' && v.dynamic_type
  )

  const parts = []

  for (const dv of dynamic_values) {
    parts.push(resolve_nfl_week_dynamic({ dv, def }))
  }

  if (static_values.length) {
    parts.push(format_nfl_week_param_values({ nfl_weeks: static_values }))
  }

  return parts.join(', ')
}

export const nfl_week_id = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  column_name: 'nfl_week_id',
  label: 'NFL Week',
  values: get_all_nfl_week_identifiers(),
  default_value: { dynamic_type: 'current_year_reg_weeks' },
  enable_multi_on_split: ['year', 'week'],
  format_value: format_nfl_week_id_value,
  dynamic_values: [
    {
      dynamic_type: 'current_year_reg_weeks',
      label: 'Current Year REG Weeks'
    },
    {
      dynamic_type: 'current_nfl_week',
      label: 'Current NFL Week'
    },
    {
      dynamic_type: 'last_n_nfl_weeks',
      label: 'Last N NFL Weeks',
      default_value: 5,
      has_value_field: true
    },
    {
      dynamic_type: 'last_n_nfl_years',
      label: 'Last N NFL Years',
      default_value: 3,
      has_value_field: true
    }
  ]
}

export const single_nfl_week_id = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  column_name: 'nfl_week_id',
  label: 'NFL Week',
  values: get_all_nfl_week_identifiers(),
  default_value: { dynamic_type: 'current_nfl_week' },
  format_value: format_nfl_week_id_value,
  dynamic_values: [
    {
      dynamic_type: 'current_nfl_week',
      label: 'Current NFL Week'
    }
  ]
}
