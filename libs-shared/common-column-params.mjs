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
  format_nfl_week_param_values
} from './nfl-week-identifier.mjs'
import {
  resolve_nfl_week_dynamic_value,
  format_nfl_week_identifiers_label
} from './nfl-week-dynamic-values.mjs'

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
      const current = current_season.last_completed_season_year
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
          // Clamped exactly as single_week's default_value is. Week 0 is the
          // season-long slot, so the unclamped label named a different week
          // than the filter selected for the whole offseason.
          return `${Math.max(current, 1)}`
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

// year_offset is a relative-year window: N is added to the row's year, and the
// range is a SUM over [row_year + lo, row_year + hi]. Render clear relative-year
// language instead of the raw `lo+` numeric span. The `variant` forwarded by the
// react-table engine selects a terse chip label (short) or a descriptive phrase
// (long); closed multi-year spans fall back to a compact signed-offset span so
// the short chip stays under ~10 characters.
const year_offset_word = (n) => {
  if (n === 0) return 'cur'
  if (n === -1) return 'prior'
  if (n === 1) return 'next'
  if (n < 0) return `${-n}y prior`
  return `${n}y fwd`
}

const year_offset_phrase = (n) => {
  if (n === 0) return 'current year'
  if (n === -1) return 'prior year'
  if (n === 1) return 'next year'
  if (n < 0) return `${-n} yrs prior`
  return `${n} yrs later`
}

const signed_offset = (n) => (n > 0 ? `+${n}` : `${n}`)

const format_year_offset_value = ({ value, def, variant }) => {
  const { min, max } = def || {}
  const is_long = variant === 'long'
  const scalar = (n) => (is_long ? year_offset_phrase(n) : year_offset_word(n))

  if (!Array.isArray(value)) return scalar(Number(value))
  if (value.length < 2) return scalar(Number(value[0]))

  const lo = Math.min(Number(value[0]), Number(value[1]))
  const hi = Math.max(Number(value[0]), Number(value[1]))
  const at_min = typeof min === 'number' && lo <= min
  const at_max = typeof max === 'number' && hi >= max

  if (at_min && at_max) return is_long ? 'all years' : 'all'
  if (lo === hi) return scalar(lo)
  if (at_max) {
    return is_long
      ? `${year_offset_phrase(lo)} onward`
      : `${year_offset_word(lo)}+`
  }
  if (at_min) {
    return is_long
      ? `through ${year_offset_phrase(hi)}`
      : `≤${year_offset_word(hi)}`
  }
  return is_long
    ? `${year_offset_phrase(lo)} to ${year_offset_phrase(hi)}`
    : `${signed_offset(lo)}..${signed_offset(hi)}y`
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
  default_value: current_season.last_completed_season_year,
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
  default_value: current_season.last_completed_season_year,
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
  format_value: format_year_offset_value,
  enable_on_row_axes: ['year']
}

export const single_year_offset = {
  data_type: table_constants.TABLE_DATA_TYPES.RANGE,
  label: 'Year + N',
  min: -30,
  max: 30,
  default_value: 0,
  is_single: true,
  format_value: format_year_offset_value,
  enable_on_row_axes: ['year']
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

// PFF's season-level vocabulary rather than the NFL's, so it cannot reuse
// nfl_season_types: REGPO is PFF's own spelling for the combined
// regular-season-plus-postseason value, and PRE has no entry because PFF
// publishes no preseason season-level grades. REGPO is the default because it
// is what every pff_player_seasonlogs row held before the season-type dimension
// existed, so a view sending no season param reads what it always read.
export const pff_seas_type = {
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  single: true,
  values: ['REG', 'POST', 'REGPO'],
  default_value: 'REGPO'
}

// One measure, one presentation. This used to be a fourth copy of the resolver
// switch that produced its own labels by hand -- and it anchored
// last_n_nfl_years on current_season.year while the client notice anchored it
// on the last completed season, so the chip and the notice described the same
// filter as different spans for half the year.
const resolve_nfl_week_dynamic = ({ dv, def }) => {
  const dynamic_def = def?.dynamic_values?.find(
    (d) => d.dynamic_type === dv.dynamic_type
  )
  const fallback =
    (dynamic_def?.label || dv.dynamic_type) +
    (dv.value != null ? ` (${dv.value})` : '')

  const nfl_weeks = resolve_nfl_week_dynamic_value({
    dynamic_type: dv.dynamic_type,
    value: dv.value ?? dynamic_def?.default_value
  })

  return format_nfl_week_identifiers_label({ nfl_weeks }) || fallback
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
      dynamic_type: 'last_completed_nfl_week',
      label: 'Last Completed NFL Week'
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
  column_name: 'nfl_week_id',
  label: 'NFL Week',
  values: get_all_nfl_week_identifiers(),
  default_value: { dynamic_type: 'current_nfl_week' },
  format_value: format_nfl_week_id_value,
  // A "single" param still declares many-valued types. A week-split column fans
  // one fact across every week in the list (resolve_nfl_week_ids), and the
  // scalar callers take the first element. This was safe to widen only once
  // resolve_nfl_week_params expanded single_nfl_week_id through the same
  // complete expander nfl_week_id goes through -- before that, a declared type
  // the partial resolver did not know resolved to nothing while still reading
  // as an explicit time scope, and the row axis fanned out.
  dynamic_values: [
    {
      dynamic_type: 'current_nfl_week',
      label: 'Current NFL Week'
    },
    {
      dynamic_type: 'last_completed_nfl_week',
      label: 'Last Completed NFL Week'
    },
    {
      dynamic_type: 'current_year_reg_weeks',
      label: 'Current Year REG Weeks'
    }
  ]
}
