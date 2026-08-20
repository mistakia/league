// Pure helpers for the `as_of_month_day` column param, kept out of the
// component module so the fields file can render a chip label without
// importing React -- no fields file imports a component.
//
// The value is a bare `MM-DD` naming a RECURRING calendar day, so February
// carries 29 days unconditionally. That is the whole reason this param is not
// a DatePicker: a picker is bound to a concrete year and cannot express
// February 29 in a non-leap one.

import { KEEPTRADECUT_AS_OF_WINDOW_DAYS } from '#libs-shared/data-views-constants.mjs'

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

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

const start_of_day = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const to_array = (value) => {
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/*
  Resolve an `MM-DD` to a real date inside one year, clamped the way the server
  clamps it. `make_date` RAISES on a day the month does not have, so the emitter
  resolves 02-29 to February 28 in a non-leap year -- while a bare JS Date rolls
  it FORWARD to March 1. Rolling forward would put the window a day later than
  the query actually uses.
*/
const anchor_date_for_year = ({ month, day, year }) => {
  const last_day_of_month = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(day, last_day_of_month))
}

/*
  Is the window behind an `as_of_month_day` anchor open yet?

  A KeepTradeCut column pinned to a day that has not arrived renders BLANK for
  every player, and the blank is correct: the value is the latest observation in
  the 30 days before the anchor, and a future window holds none yet. Nothing on
  the page said so -- a reader could not tell it apart from a coverage gap, a
  bad param or a broken join -- which is the whole reason this exists.

  Deliberately calendar-only. Answering "is there data yet" exactly would take a
  round trip for the latest observation per year; the floor plus today's date
  already decides the blank case, and a control that has to query to render is a
  much larger thing than the question deserves.

  @returns {'open'|'partial'|'not_open'} across every year in scope, reported as
    the most open of them -- one populated year is enough for the column not to
    read as empty.
*/
export const as_of_window_status = ({
  month_day,
  years,
  today = new Date(),
  window_days = KEEPTRADECUT_AS_OF_WINDOW_DAYS
}) => {
  const parsed = parse_month_day(month_day)
  if (!parsed) return null

  const years_in_scope = to_array(years)
    .map(Number)
    .filter((year) => Number.isInteger(year))
  if (!years_in_scope.length) return null

  const today_start = start_of_day(today)
  let soonest_window_opens_at = null
  let best = 'not_open'

  for (const year of years_in_scope) {
    const anchor = anchor_date_for_year({ ...parsed, year })
    const window_opens_at = new Date(
      anchor.getTime() - window_days * MILLISECONDS_PER_DAY
    )

    if (window_opens_at > today_start) {
      if (!soonest_window_opens_at || window_opens_at < soonest_window_opens_at)
        soonest_window_opens_at = window_opens_at
      continue
    }

    // The window has opened. It is still filling until the anchor itself
    // passes, so a reader looking today sees only the players ranked since it
    // opened -- 473 of 500 rows in the recorded case.
    if (anchor > today_start) {
      if (best === 'not_open') best = 'partial'
      continue
    }

    return { status: 'open', window_opens_at: null }
  }

  return {
    status: best,
    window_opens_at: best === 'not_open' ? soonest_window_opens_at : null
  }
}

/*
  The years an `as_of_month_day` column actually resolves against, read off its
  sibling params. `year_offset` shifts the anchor into another year, so ignoring
  it would warn about a future day on a column pinned to a past one.
*/
export const as_of_years_in_scope = ({ column_params = {}, default_year }) => {
  const base_years = to_array(column_params.year)
    .map(Number)
    .filter((year) => Number.isInteger(year))
  const years = base_years.length ? base_years : to_array(default_year)

  const offsets = to_array(column_params.year_offset)
    .map(Number)
    .filter((offset) => Number.isInteger(offset))
  if (!offsets.length) return years

  return years.flatMap((year) => offsets.map((offset) => year + offset))
}
