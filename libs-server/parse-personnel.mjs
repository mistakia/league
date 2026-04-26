// Parse NFL-feed personnel strings (off_personnel / def_personnel) into
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

export const PERSONNEL_OFF_COLUMNS = {
  qb: 'off_personnel_qb_count',
  rb: 'off_personnel_rb_count',
  te: 'off_personnel_te_count',
  wr: 'off_personnel_wr_count',
  ol: 'off_personnel_ol_count'
}

export const PERSONNEL_DEF_COLUMNS = {
  dl: 'def_personnel_dl_count',
  lb: 'def_personnel_lb_count',
  db: 'def_personnel_db_count'
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
  if (side !== 'off' && side !== 'def') {
    throw new Error(`parse_personnel_string: invalid side '${side}'`)
  }
  return side === 'off' ? parse_offensive(value) : parse_defensive(value)
}

export const add_personnel_counts_to_play_data = (play) => {
  if (!play) return play

  for (const [side, column_map] of [
    ['off', PERSONNEL_OFF_COLUMNS],
    ['def', PERSONNEL_DEF_COLUMNS]
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
