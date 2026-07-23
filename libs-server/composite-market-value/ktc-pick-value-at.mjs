import { keeptradecut_metric_types } from '#libs-shared/constants/source-constants.mjs'
import db from '#db'

// Point-in-time KTC value for a draft pick keyed by
// (pick_year, pick_round, pick_draft_overall_position, num_teams, target_unix).
//
// KTC publishes pick rankings as synthetic "players" registered in
// `keeptradecut_pick` -- `(year, round, slot)` where slot is 1=Early / 2=Mid /
// 3=Late. Their daily KTC values live in `keeptradecut_rankings`. The earliest
// record in this database is 2023-09-08; pre-2023 trades therefore have no
// direct KTC pick data and require an analog-year fallback.
//
// Slot derivation: thirds of `num_teams`. For 10-team: positions 1-3 = Early,
// 4-7 = Mid, 8-10 = Late. For 12-team: 1-4 = Early, 5-8 = Mid, 9-12 = Late.

export const PICK_SLOT = { EARLY: 1, MID: 2, LATE: 3 }

export const slot_from_position = (overall_position, num_teams) => {
  if (overall_position == null || num_teams == null || num_teams <= 0)
    return null
  const third = num_teams / 3
  if (overall_position <= third) return PICK_SLOT.EARLY
  if (overall_position <= 2 * third) return PICK_SLOT.MID
  return PICK_SLOT.LATE
}

// Load all KTCPICK indexes once. Keys:
//   idx.pick_pid_by_yrs.get(`${year}__${round}__${slot}`) -> pid
//   idx.pick_pid_meta.get(pid) -> { year, round, slot }
//   idx.ktc_picks.get(pid) -> [{ d, v }] sorted by d asc
export const load_pick_ktc_indexes = async ({ qb_axis }) => {
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
  const ktc_rows = await db('keeptradecut_rankings')
    .select('pid', 'd', 'v')
    .whereIn('pid', pids)
    .where('qb', qb_axis)
    .where('type', keeptradecut_metric_types.VALUE)
    .orderBy('d', 'asc')
  for (const r of ktc_rows) {
    if (!idx.ktc_picks.has(r.pid)) idx.ktc_picks.set(r.pid, [])
    idx.ktc_picks.get(r.pid).push({ d: r.d, v: Number(r.v) })
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
  num_teams,
  target_unix,
  idx
}) => {
  const slot = slot_from_position(pick_overall_position, num_teams)
  if (slot == null || pick_year == null || pick_round == null) return null

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
