import { current_season, nfl_season_types } from '#constants'

const NFL_WEEK_REGEX = /^(\d{4})_(PRE|REG|POST)_WEEK_(\d+)$/

export const WEEK_RANGES = {
  PRE: { min: 1, max: 4 },
  POST: { min: 1, max: 4 }
}

const MIN_YEAR = 2000

// Era-specific REG week caps, sourced from nfl_games history.
// 1970-1977 = 14, 1978-1989 = 16 (1982 strike = 9, 1987 strike = 15),
// 1990-2020 = 17, 2021+ = 18.
const REG_MAX_WEEKS_BY_ERA = ({ year }) => {
  if (year === 1982) return 9
  if (year === 1987) return 15
  if (year < 1978) return 14
  if (year < 1990) return 16
  if (year < 2021) return 17
  return 18
}

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

  const max = get_max_weeks_for_season_type({ seas_type, year })
  if (!max) return false

  if (week < 1 || week > max) return false

  return true
}

export const get_nfl_week_identifiers_for_year = ({
  year,
  seas_type = null
}) => {
  const types = seas_type ? [seas_type] : nfl_season_types
  const identifiers = []

  for (const st of types) {
    const max = get_max_weeks_for_season_type({ seas_type: st, year })
    if (!max) continue
    const min = st === 'REG' ? 1 : WEEK_RANGES[st].min
    for (let w = min; w <= max; w++) {
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
      const candidate = format_nfl_week_identifier({
        year: offset_year,
        seas_type: parsed.seas_type,
        week: parsed.week
      })
      if (!validate_nfl_week_identifier({ identifier: candidate })) continue
      expanded.push(candidate)
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

export const current_nfl_week_params = () => {
  const year = current_season.stats_season_year
  const live_type = current_season.nfl_seas_type
  if (live_type === 'POST') {
    return {
      year,
      seas_type: 'POST',
      week: Math.max(current_season.nfl_seas_week, 1)
    }
  }
  // REG and PRE (offseason) both default to the REG track. During offseason
  // current_season.week is 0, which we clamp to REG week 1 as the last
  // meaningful identifier for default queries.
  return {
    year,
    seas_type: 'REG',
    week: Math.max(current_season.week, 1)
  }
}

export const current_nfl_week_identifier = () => {
  return format_nfl_week_identifier(current_nfl_week_params())
}

export const nfl_week_offset_params = ({ offset }) => {
  if (offset === 0) return current_nfl_week_params()
  if (offset > 0) {
    throw new Error(
      `nfl_week_offset_params: positive offsets are not supported (got ${offset})`
    )
  }

  const { year, seas_type, week } = current_nfl_week_params()
  const steps = -offset
  const cur_year = year
  let cur_seas_type = seas_type
  let cur_week = week

  for (let i = 0; i < steps; i++) {
    if (cur_seas_type === 'POST') {
      if (cur_week > 1) {
        cur_week -= 1
      } else {
        cur_seas_type = 'REG'
        cur_week = REG_MAX_WEEKS_BY_ERA({ year: cur_year })
      }
    } else if (cur_seas_type === 'REG') {
      if (cur_week > 1) {
        cur_week -= 1
      } else {
        return null
      }
    } else {
      return null
    }
  }

  return { year: cur_year, seas_type: cur_seas_type, week: cur_week }
}

// Reference-week params for joins that need a "prior" week with a one-week
// bye fallback. `prior_params` is the most recent played week; `fallback_params`
// is two-weeks-prior when that exists, otherwise prior. Returns null when no
// prior week exists (offseason / REG week 1).
export const reference_week_fallback_params = () => {
  const prior_params = nfl_week_offset_params({ offset: -1 })
  if (!prior_params) return null
  const two_weeks_prior_params = nfl_week_offset_params({ offset: -2 })
  return {
    prior_params,
    fallback_params: two_weeks_prior_params || prior_params
  }
}

// Resolves a "year-only" saved view intent to the most meaningful REG week
// for that year. Past/current years return a REG identifier; future years or
// years before MIN_YEAR return null. For the live year, returns the current
// REG week (clamped to >= 1) during REG, REG era-max during POST, and REG
// week 1 during PRE/offseason.
export const last_meaningful_reg_week_params_for_year = ({ year }) => {
  if (year == null) return null
  if (year < MIN_YEAR || year > current_season.year) return null
  if (year < current_season.year) {
    return { year, seas_type: 'REG', week: REG_MAX_WEEKS_BY_ERA({ year }) }
  }
  const live_type = current_season.nfl_seas_type
  if (live_type === 'POST') {
    return { year, seas_type: 'REG', week: REG_MAX_WEEKS_BY_ERA({ year }) }
  }
  if (live_type === 'REG') {
    return { year, seas_type: 'REG', week: Math.max(current_season.week, 1) }
  }
  return { year, seas_type: 'REG', week: 1 }
}

export const get_max_weeks_for_season_type = ({ seas_type, year }) => {
  if (seas_type === 'REG') {
    if (!year) return 0
    return REG_MAX_WEEKS_BY_ERA({ year })
  }
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
          ? weeks.map((w) => get_postseason_week_label({ week: w })).join(', ')
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
