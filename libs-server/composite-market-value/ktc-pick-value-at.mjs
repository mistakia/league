import db from '#db'

// Point-in-time KTC value for a draft pick keyed by
// (pick_year, pick_round, pick_draft_overall_position, number_teams, target_unix).
//
// KTC publishes pick rankings as synthetic "players" registered in
// `keeptradecut_pick` -- `(year, round, slot)` where slot is 1=Early / 2=Mid /
// 3=Late. Their daily KTC values live in `keeptradecut_valuations`. The earliest
// record in this database is 2023-09-08; pre-2023 trades therefore have no
// direct KTC pick data and require an analog-year fallback.
//
// Slot derivation: thirds of `number_teams`, over the pick's position WITHIN its
// own round. For 10-team: positions 1-3 = Early, 4-7 = Mid, 8-10 = Late. For
// 12-team: 1-4 = Early, 5-8 = Mid, 9-12 = Late.

export const PICK_SLOT = { EARLY: 1, MID: 2, LATE: 3 }

export const slot_from_position = (position_in_round, number_teams) => {
  if (position_in_round == null || number_teams == null || number_teams <= 0)
    return null
  const third = number_teams / 3
  if (position_in_round <= third) return PICK_SLOT.EARLY
  if (position_in_round <= 2 * third) return PICK_SLOT.MID
  return PICK_SLOT.LATE
}

// `keeptradecut_pick` is keyed (year, round, slot) and the three slots partition
// ONE round, so the slot is a function of where a pick sits inside its round.
// Every caller supplies `roster_asset_holding.pick_draft_overall_position`,
// which is the league-wide rank, so it has to be reduced to its round before
// bucketing: overall 13 in a 10-team league is round 2 pick 3 -- an EARLY pick,
// not the LATE one its raw overall rank buckets to. Passing the overall rank
// straight through put every pick outside round 1 in the LATE slot, since an
// overall rank in round 2 or beyond always exceeds two thirds of number_teams.
const position_within_round = ({
  overall_position,
  pick_round,
  number_teams
}) => {
  if (overall_position == null || pick_round == null || number_teams == null)
    return null
  return overall_position - (pick_round - 1) * number_teams
}

// A pick for a future draft has no assigned overall position yet -- the order is
// set by standings that have not happened. Those are the picks most often
// traded, so bailing on them priced every future pick at NULL and silently
// dropped one whole side of any trade involving one. KTC itself quotes an
// unassigned future pick at the middle tier, so that is the honest default.
//
// The same default covers a within-round position outside 1..number_teams, which
// means the overall rank and the round disagree -- a pick recorded against a
// league size it was not endowed under, say. Pricing that at the middle tier
// beats pricing it at whichever edge the out-of-range value buckets to.
const resolve_slot = ({ pick_overall_position, pick_round, number_teams }) => {
  if (pick_overall_position == null) return PICK_SLOT.MID
  const within_round = position_within_round({
    overall_position: pick_overall_position,
    pick_round,
    number_teams
  })
  if (within_round == null) return null
  if (within_round < 1 || within_round > number_teams) return PICK_SLOT.MID
  return slot_from_position(within_round, number_teams)
}

// Load all KTCPICK indexes once. Keys:
//   idx.pick_pid_by_yrs.get(`${year}__${round}__${slot}`) -> pid
//   idx.pick_pid_meta.get(pid) -> { year, round, slot }
//   idx.ktc_picks.get(pid) -> [{ d, v }] sorted by d asc, d in epoch SECONDS
export const load_pick_ktc_indexes = async ({ is_superflex }) => {
  const idx = {
    pick_pid_by_yrs: new Map(),
    pick_pid_meta: new Map(),
    ktc_picks: new Map()
  }
  const pids_rows = await db('keeptradecut_pick').select(
    'pid',
    'season_year',
    'round',
    'slot'
  )
  for (const r of pids_rows) {
    const k = `${r.season_year}__${r.round}__${r.slot}`
    idx.pick_pid_by_yrs.set(k, r.pid)
    idx.pick_pid_meta.set(r.pid, {
      year: r.season_year,
      round: r.round,
      slot: r.slot
    })
  }
  if (!pids_rows.length) return idx
  const pids = pids_rows.map((r) => r.pid)
  const ktc_rows = await db('keeptradecut_valuations')
    .select('pid', 'observed_at', 'keeptradecut_value')
    .whereIn('pid', pids)
    .where('is_superflex', is_superflex)
    .orderBy('observed_at', 'asc')
  // observed_at is timestamptz and arrives as a JS Date. Every comparison and
  // every piece of arithmetic below -- lookup_le, unix_of_ymd, the centrality
  // window -- is in epoch seconds, and a Date compared against a number coerces
  // to milliseconds and is silently always false, so normalise at the boundary.
  for (const r of ktc_rows) {
    if (!idx.ktc_picks.has(r.pid)) idx.ktc_picks.set(r.pid, [])
    idx.ktc_picks.get(r.pid).push({
      d: Math.floor(r.observed_at.getTime() / 1000),
      v: Number(r.keeptradecut_value)
    })
  }
  return idx
}

const year_of_unix = (unix) => new Date(unix * 1000).getUTCFullYear()
const month_day_of_unix = (unix) => {
  const d = new Date(unix * 1000)
  return { month: d.getUTCMonth(), day: d.getUTCDate() }
}
const unix_of_ymd = (year, md) =>
  Math.floor(Date.UTC(year, md.month, md.day) / 1000)

const lookup_le = (rows, target_unix) => {
  if (!rows || !rows.length) return null
  let last_le = null
  for (const r of rows) {
    if (r.d <= target_unix) last_le = r
    else break
  }
  return last_le ? last_le.v : null
}

// Point-in-time KTC value. Returns null if no exact or analog data is available.
//
// Resolution order:
//   1) Exact lookup: KTCPICK pid for (pick_year, round, slot) with a record on
//      or before target_unix.
//   2) Analog-year fallback: find a year `analog_year` where KTCPICK
//      (analog_year, round, slot) has data, and where
//        analog_year - calendar_year_of_first_record == pick_year - calendar_year_of_target.
//      Within that analog series, pick the record nearest the same
//      month/day as target_unix.
//   3) NULL.
export const ktc_pick_at = ({
  pick_year,
  pick_round,
  pick_overall_position,
  number_teams,
  target_unix,
  idx
}) => {
  if (pick_year == null || pick_round == null) return null
  const slot = resolve_slot({
    pick_overall_position,
    pick_round,
    number_teams
  })
  if (slot == null) return null

  // 1) Exact lookup
  const exact_pid = idx.pick_pid_by_yrs.get(
    `${pick_year}__${pick_round}__${slot}`
  )
  if (exact_pid) {
    const rows = idx.ktc_picks.get(exact_pid)
    if (rows && rows.length && rows[0].d <= target_unix) {
      const v = lookup_le(rows, target_unix)
      if (v != null) return v
    }
  }

  // 2) Analog-year fallback. For a target (pick_year, target_unix), define
  // years_out = pick_year - calendar_year(target_unix). For any analog pick
  // (analog.year, round, slot) the equivalent query date is calendar_year =
  // analog.year - years_out with the same month/day as target_unix. The analog
  // works if its KTC series spans that synthetic date. Among valid analogs,
  // prefer the one whose analog target date sits most centrally within its
  // own data window (avoids edge-of-series instability).
  const target_calendar_year = year_of_unix(target_unix)
  const years_out = pick_year - target_calendar_year
  const md = month_day_of_unix(target_unix)
  let best_v = null
  let best_centrality = -Infinity
  for (const [pid, meta] of idx.pick_pid_meta) {
    if (meta.round !== pick_round || meta.slot !== slot) continue
    const rows = idx.ktc_picks.get(pid)
    if (!rows || !rows.length) continue
    const analog_target_unix = unix_of_ymd(meta.year - years_out, md)
    if (analog_target_unix < rows[0].d) continue
    if (analog_target_unix > rows[rows.length - 1].d) continue
    const v = lookup_le(rows, analog_target_unix)
    if (v == null) continue
    // Centrality: distance from nearest edge of the series; larger = more central.
    const centrality = Math.min(
      analog_target_unix - rows[0].d,
      rows[rows.length - 1].d - analog_target_unix
    )
    if (centrality > best_centrality) {
      best_centrality = centrality
      best_v = v
    }
  }
  if (best_v != null) return best_v

  // 3) No data
  return null
}
