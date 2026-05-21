import db from '#db'

// Shared helpers across composite-market-value modules.

export const median = (xs) => {
  const sorted = xs.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Load the format-aware pick-value curve as a Map<rank, pts_added_per_game>.
// Used by ADP and rankings extractors as the format-aware nonlinear pre-transform.
export const load_pick_value_curve = async ({ league_format_hash }) => {
  const rows = await db('league_format_draft_pick_value')
    .select('rank', 'median_best_season_points_added_per_game')
    .where('league_format_hash', league_format_hash)
  const curve = new Map()
  for (const r of rows) {
    curve.set(r.rank, r.median_best_season_points_added_per_game != null
      ? Number(r.median_best_season_points_added_per_game)
      : null)
  }
  return curve
}

// Index a Map<`${pid}__${date_iso}`, value> by pid for O(1) per-pid lookups.
// Returned shape: Map<pid, Array<{ date: 'YYYY-MM-DD', v: number }>> sorted asc by date.
export const index_by_pid = (map) => {
  const idx = new Map()
  for (const [k, v] of map) {
    const [pid, date_iso] = k.split('__')
    if (!idx.has(pid)) idx.set(pid, [])
    idx.get(pid).push({ date: date_iso, v })
  }
  for (const arr of idx.values()) arr.sort((a, b) => a.date.localeCompare(b.date))
  return idx
}

// Most recent value for pid within [target_date - window_days, target_date]
// against a pid-indexed map. Returns null if none in window.
export const latest_in_window_by_pid = (pid_idx, pid, target_date_iso, window_days) => {
  const arr = pid_idx.get(pid)
  if (!arr) return null
  const cutoff_ms = new Date(target_date_iso).getTime() - window_days * 86400_000
  const target_ms = new Date(target_date_iso).getTime()
  let best = null
  for (let i = arr.length - 1; i >= 0; i--) {
    const t = new Date(arr[i].date).getTime()
    if (t > target_ms) continue
    if (t < cutoff_ms) break
    best = arr[i].v
    break
  }
  return best
}

// Resolve a representative (league_format_hash, scoring_format_hash) per
// format_category for source-axis lookups. Cached per process.
let _fc_format_cache = null
export const load_fc_format_map = async () => {
  if (_fc_format_cache) return _fc_format_cache
  const out = new Map()
  const mappings = await db('format_category_signal_mapping').orderBy('format_category')
  for (const m of mappings) {
    const row = await db('league_formats').where('format_category', m.format_category).first()
    if (row) out.set(m.format_category, {
      league_format_hash: row.league_format_hash,
      scoring_format_hash: row.scoring_format_hash
    })
  }
  _fc_format_cache = out
  return out
}
