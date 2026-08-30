// Parse NFL-feed personnel strings (offense_personnel / defense_personnel) into
// position-count objects. The NFL feed is the authoritative source; PlayerProfiler
// counts (which use a different snap-classification convention) live in separate
// _pp columns and are not produced by this parser.

const OFF_LONG_RE = /(\d+)\s*(QB|RB|TE|WR|OL)\b/gi
// The lookbehind is load-bearing, not defensive polish. Without it this pattern
// matches the trailing `3DB` of the vendor's `0-3DB` and reports { dl: 0, lb: 0,
// db: 3 } -- so deleting the package softmap alone would NOT have stopped that
// vocabulary being parsed, it would only have moved which line did it. A count
// preceded by a digit, a hyphen or a plus is part of some other token, never a
// position count of its own.
const DEF_LONG_RE = /(?<![-+\d])(\d+)\s*(DL|LB|DB)\b/gi

// This parser once also accepted two shapes no NFL feed has ever emitted: the
// two-digit offensive short code (11, 01*) and a defensive package softmap
// (Nickel, Dime, Base, 0-3DB, 7+DB). Both arrived on 2026-04-26, three weeks
// after the charting import first ran, and both existed only to make sense of
// that vendor's vocabulary landing in these columns -- which was itself the
// defect. With the mapping deleted and the contaminated rows repaired, no row
// in nfl_plays or nfl_plays_current_week carries either shape, in any of the 27
// seasons. They are deliberately not restored: accepting a vocabulary is what
// would quietly re-admit it if a mapping were ever added back.

export const PERSONNEL_OFFENSE_COLUMNS = {
  qb: 'offense_personnel_quarterback_count',
  rb: 'offense_personnel_running_back_count',
  te: 'offense_personnel_tight_end_count',
  wr: 'offense_personnel_wide_receiver_count',
  ol: 'offense_personnel_offensive_line_count'
}

export const PERSONNEL_DEFENSE_COLUMNS = {
  dl: 'defense_personnel_defensive_line_count',
  lb: 'defense_personnel_linebacker_count',
  db: 'defense_personnel_defensive_back_count'
}

const parse_offensive = (value) => {
  const trimmed = value.trim()

  const counts = { qb: 1, rb: 0, te: 0, wr: 0, ol: 5 }
  let matched = false
  for (const match of trimmed.matchAll(OFF_LONG_RE)) {
    counts[match[2].toLowerCase()] = Number(match[1])
    matched = true
  }
  return matched ? counts : null
}

const parse_defensive = (value) => {
  const trimmed = value.trim()

  const counts = { dl: 0, lb: 0, db: 0 }
  let matched = false
  for (const match of trimmed.matchAll(DEF_LONG_RE)) {
    counts[match[2].toLowerCase()] = Number(match[1])
    matched = true
  }
  return matched ? counts : null
}

export const parse_personnel_string = ({ value, side }) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  if (value.trim() === '') return null
  if (side !== 'offense' && side !== 'defense') {
    throw new Error(`parse_personnel_string: invalid side '${side}'`)
  }
  return side === 'offense' ? parse_offensive(value) : parse_defensive(value)
}

export const add_personnel_counts_to_play_data = (play) => {
  if (!play) return play

  // `side` is BOTH the parser's dispatch value and the prefix of the physical
  // column it reads (`${side}_personnel`), so the 2026-08-16 side-prefix conform
  // had to move it with the columns. It is a computed key, which is exactly the
  // shape a name-anchored sweep cannot reach: renaming the columns alone left
  // this loop reading `off_personnel`, finding undefined, and writing NOTHING --
  // silently, since the miss takes the `continue` branch.
  for (const [side, column_map] of [
    ['offense', PERSONNEL_OFFENSE_COLUMNS],
    ['defense', PERSONNEL_DEFENSE_COLUMNS]
  ]) {
    const value = play[`${side}_personnel`]
    if (!value) continue
    const parsed = parse_personnel_string({ value, side })
    if (!parsed) continue
    for (const [key, column] of Object.entries(column_map)) {
      if (parsed[key] != null) play[column] = parsed[key]
    }
  }

  return play
}
