// Pure helpers for the `as_of_month_day` column param, kept out of the
// component module so the fields file can render a chip label without
// importing React -- no fields file imports a component.
//
// The value is a bare `MM-DD` naming a RECURRING calendar day, so February
// carries 29 days unconditionally. That is the whole reason this param is not
// a DatePicker: a picker is bound to a concrete year and cannot express
// February 29 in a non-leap one.

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const MONTH_DAY_PATTERN = /^(\d{2})-(\d{2})$/

// Mirrors the server's parse in
// libs-server/data-views-column-definitions/player-keeptradecut-column-definitions.mjs,
// except that this returns null where the server throws -- the control uses it
// to validate BEFORE writing state, so a value the server would reject is
// never persisted.
export const parse_month_day = (value) => {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null

  const match = raw.match(MONTH_DAY_PATTERN)
  if (!match) return null

  const month = Number(match[1])
  const day = Number(match[2])
  if (month < 1 || month > 12) return null
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]) return null

  return { month, day }
}

export const format_month_day = (value) => {
  const parsed = parse_month_day(value)
  if (!parsed) return null
  return `${MONTH_LABELS[parsed.month - 1]} ${parsed.day}`
}

export const to_month_day = ({ month, day }) =>
  `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
