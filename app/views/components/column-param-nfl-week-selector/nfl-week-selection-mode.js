import { nfl_week_identifier } from '@libs-shared'

const {
  parse_nfl_week_identifier,
  format_nfl_week_identifier,
  validate_nfl_week_identifier,
  get_nfl_week_identifiers_for_year,
  WEEK_RANGES
} = nfl_week_identifier

export const purge_dynamic = (current_selection) =>
  (current_selection || []).filter((v) => typeof v === 'string')

export const purge_static = (current_selection) =>
  (current_selection || []).filter((v) => v && typeof v === 'object')

export const purge_static_group = ({ current_selection, group_key }) => {
  const [year_str, seas_type] = group_key.split('_')
  const year = parseInt(year_str, 10)
  return (current_selection || []).filter((v) => {
    if (typeof v !== 'string') return true
    const parsed = parse_nfl_week_identifier({ identifier: v })
    if (!parsed) return true
    return !(parsed.year === year && parsed.seas_type === seas_type)
  })
}

const validated_identifiers_for_year = ({ year, seas_type = 'REG' }) =>
  get_nfl_week_identifiers_for_year({ year, seas_type }).filter((id) =>
    validate_nfl_week_identifier({ identifier: id })
  )

export const apply_year_selection = ({ year, current_selection }) => {
  const statics = purge_dynamic(current_selection)
  const year_ids = validated_identifiers_for_year({ year, seas_type: 'REG' })
  const all_present =
    year_ids.length > 0 && year_ids.every((id) => statics.includes(id))
  if (all_present) return statics.filter((id) => !year_ids.includes(id))
  return [...new Set([...statics, ...year_ids])]
}

export const apply_year_range_selection = ({
  from_year,
  to_year,
  current_selection,
  mode = 'select'
}) => {
  const statics = purge_dynamic(current_selection)
  const start = Math.min(from_year, to_year)
  const end = Math.max(from_year, to_year)
  const range_ids = []
  for (let y = start; y <= end; y++) {
    range_ids.push(
      ...validated_identifiers_for_year({ year: y, seas_type: 'REG' })
    )
  }
  if (mode === 'deselect') {
    return statics.filter((id) => !range_ids.includes(id))
  }
  return [...new Set([...statics, ...range_ids])]
}

export const apply_per_week_toggle = ({
  year,
  seas_type,
  week,
  current_selection
}) => {
  const identifier = format_nfl_week_identifier({ year, seas_type, week })
  if (!validate_nfl_week_identifier({ identifier })) {
    return purge_dynamic(current_selection)
  }
  const statics = purge_dynamic(current_selection)
  if (statics.includes(identifier)) {
    return statics.filter((v) => v !== identifier)
  }
  return [...statics, identifier]
}

export const apply_season_type_bulk = ({
  year,
  seas_type,
  action,
  current_selection
}) => {
  const statics = purge_dynamic(current_selection)
  const prefix = `${year}_${seas_type}_WEEK_`
  const remaining = statics.filter((v) => !v.startsWith(prefix))
  if (action === 'clear') return remaining
  const range = WEEK_RANGES[seas_type]
  if (!range) return remaining
  const added = []
  for (let w = range.min; w <= range.max; w++) {
    const id = format_nfl_week_identifier({ year, seas_type, week: w })
    if (validate_nfl_week_identifier({ identifier: id })) added.push(id)
  }
  return [...remaining, ...added]
}

export const apply_dynamic_toggle = ({
  dynamic_type,
  dynamic_value,
  current_selection
}) => {
  const existing_dynamic = purge_static(current_selection)
  const is_currently_selected = existing_dynamic.some(
    (v) => v.dynamic_type === dynamic_type
  )
  if (is_currently_selected) {
    return existing_dynamic.filter((v) => v.dynamic_type !== dynamic_type)
  }
  return [{ dynamic_type, value: dynamic_value }]
}
