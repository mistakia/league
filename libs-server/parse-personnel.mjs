// Parse NFL-feed personnel strings (offense_personnel / defense_personnel) into
// position-count objects. The NFL feed is the authoritative source; PlayerProfiler
// counts (which use a different snap-classification convention) live in separate
// _pp columns and are not produced by this parser.

const OFF_LONG_RE = /(\d+)\s*(QB|RB|TE|WR|OL)\b/gi
const DEF_LONG_RE = /(\d+)\s*(DL|LB|DB)\b/gi
const SHORT_CODE_RE = /^[0-9]{2}\*?$/

const DEF_SOFTMAP = {
  nickel: { db: 5 },
  dime: { db: 6 },
  base: { db: 4 },
  '0-3db': { db: 3 },
  '7+db': { db: 7 }
}

export const PERSONNEL_OFFENSE_COLUMNS = {
  qb: 'offense_personnel_qb_count',
  rb: 'offense_personnel_rb_count',
  te: 'offense_personnel_te_count',
  wr: 'offense_personnel_wr_count',
  ol: 'offense_personnel_ol_count'
}

export const PERSONNEL_DEFENSE_COLUMNS = {
  dl: 'defense_personnel_dl_count',
  lb: 'defense_personnel_lb_count',
  db: 'defense_personnel_db_count'
}

const parse_offensive = (value) => {
  const trimmed = value.trim()

  if (SHORT_CODE_RE.test(trimmed)) {
    const rb = Number(trimmed[0])
    const te = Number(trimmed[1])
    const wr = 5 - rb - te
    if (wr < 0) return null
    return { qb: 1, rb, te, wr, ol: 5 }
  }

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
  const softmap = DEF_SOFTMAP[trimmed.toLowerCase()]
  if (softmap) return { ...softmap }

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
