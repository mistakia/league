import { current_season, nfl_season_types } from '#constants'

const NFL_WEEK_REGEX = /^(\d{4})_(PRE|REG|POST)_WEEK_(\d+)$/

const WEEK_RANGES = {
  PRE: { min: 1, max: 4 },
  REG: { min: 1, max: 21 },
  POST: { min: 1, max: 4 }
}

const MIN_YEAR = 2000

export const parse_nfl_week_identifier = ({ identifier }) => {
  if (!identifier || typeof identifier !== 'string') return null

  const match = identifier.match(NFL_WEEK_REGEX)
  if (!match) return null

  return {
    year: parseInt(match[1], 10),
    seas_type: match[2],
    week: parseInt(match[3], 10)
  }
}

export const format_nfl_week_identifier = ({ year, seas_type, week }) => {
  return `${year}_${seas_type}_WEEK_${week}`
}

export const validate_nfl_week_identifier = ({ identifier }) => {
  const parsed = parse_nfl_week_identifier({ identifier })
  if (!parsed) return false

  const { year, seas_type, week } = parsed

  if (year < MIN_YEAR || year > current_season.year) return false

  const range = WEEK_RANGES[seas_type]
  if (!range) return false

  if (week < range.min || week > range.max) return false

  return true
}

export const get_nfl_week_identifiers_for_year = ({
  year,
  seas_type = null
}) => {
  const types = seas_type ? [seas_type] : nfl_season_types
  const identifiers = []

  for (const st of types) {
    const range = WEEK_RANGES[st]
    if (!range) continue
    for (let w = range.min; w <= range.max; w++) {
      identifiers.push(
        format_nfl_week_identifier({ year, seas_type: st, week: w })
      )
    }
  }

  return identifiers
}

export const get_all_nfl_week_identifiers = () => {
  const identifiers = []
  for (let y = current_season.year; y >= MIN_YEAR; y--) {
    identifiers.push(...get_nfl_week_identifiers_for_year({ year: y }))
  }
  return identifiers
}

export const apply_year_offset_to_nfl_weeks = ({ nfl_weeks, year_offset }) => {
  if (!year_offset || !nfl_weeks || !nfl_weeks.length) return nfl_weeks

  const offsets = Array.isArray(year_offset) ? year_offset : [year_offset]
  const min_offset = Math.min(...offsets)
  const max_offset = Math.max(...offsets)

  const expanded = []
  for (const id of nfl_weeks) {
    const parsed = parse_nfl_week_identifier({ identifier: id })
    if (!parsed) continue

    for (let offset = min_offset; offset <= max_offset; offset++) {
      const offset_year = parsed.year + offset
      if (offset_year < MIN_YEAR || offset_year > current_season.year) continue
      expanded.push(
        format_nfl_week_identifier({
          year: offset_year,
          seas_type: parsed.seas_type,
          week: parsed.week
        })
      )
    }
  }

  return [...new Set(expanded)]
}

export const group_nfl_weeks = ({ nfl_weeks }) => {
  const groups = {}
  for (const id of nfl_weeks) {
    const parsed = parse_nfl_week_identifier({ identifier: id })
    if (!parsed) continue
    const key = `${parsed.year}_${parsed.seas_type}`
    if (!groups[key]) groups[key] = []
    groups[key].push(parsed.week)
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a - b)
  }
  return groups
}

export const format_week_ranges = ({ weeks }) => {
  if (!weeks || weeks.length === 0) return ''
  const sorted = [...weeks].sort((a, b) => a - b)
  const ranges = []
  let start = sorted[0]
  let end = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`)
      start = sorted[i]
      end = sorted[i]
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`)
  return ranges.join(', ')
}

const POSTSEASON_WEEK_LABELS = {
  1: 'Wild Card',
  2: 'Divisional',
  3: 'Conference',
  4: 'Super Bowl'
}

export const get_postseason_week_label = ({ week }) => {
  return POSTSEASON_WEEK_LABELS[week] || `Week ${week}`
}

export const get_max_weeks_for_season_type = ({ seas_type }) => {
  const range = WEEK_RANGES[seas_type]
  return range ? range.max : 0
}

export const compare_nfl_week_group_keys = (a, b) => {
  const [ya, ta] = a.split('_')
  const [yb, tb] = b.split('_')
  if (ya !== yb) return parseInt(yb, 10) - parseInt(ya, 10)
  const type_order = { PRE: 0, REG: 1, POST: 2 }
  return (type_order[ta] ?? 0) - (type_order[tb] ?? 0)
}

export const format_nfl_week_param_values = ({ nfl_weeks }) => {
  if (!nfl_weeks || nfl_weeks.length === 0) return ''

  const groups = group_nfl_weeks({ nfl_weeks })
  const sorted_keys = Object.keys(groups).sort(compare_nfl_week_group_keys)

  return sorted_keys
    .map((key) => {
      const weeks = groups[key]
      const [year, seas_type] = key.split('_')
      const range_label =
        seas_type === 'POST'
          ? weeks
              .map((w) => get_postseason_week_label({ week: w }))
              .join(', ')
          : format_week_ranges({ weeks })
      return `${year} ${seas_type}: ${range_label}`
    })
    .join(', ')
}

export const decompose_nfl_weeks = ({ nfl_weeks }) => {
  const years = new Set()
  const weeks = new Set()
  const seas_types = new Set()

  for (const id of nfl_weeks) {
    const parsed = parse_nfl_week_identifier({ identifier: id })
    if (!parsed) continue
    years.add(parsed.year)
    weeks.add(parsed.week)
    seas_types.add(parsed.seas_type)
  }

  return {
    years: [...years],
    weeks: [...weeks],
    seas_types: [...seas_types]
  }
}
