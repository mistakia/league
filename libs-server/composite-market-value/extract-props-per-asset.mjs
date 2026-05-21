import db from '#db'

import { median } from '#libs-server/composite-market-value/utils.mjs'

// Season-long player-prop markets aggregated to implied season fantasy points.
// Topic 1/2/3 resolutions:
//  - Whitelist: 7 SEASON_* player stat-types (skip awards/playoffs/team props).
//  - Multi-book aggregation: median across present books per (pid, market_type, date).
//  - Scoring conversion uses position-independent rec multiplier (wrrec/rbrec/terec
//    position-specific overrides are a documented v1 limitation).
//  - v1 ignores time_type / open flags; assumes the importer's ingestion already
//    targets prematch lines.
//  - Today only FanDuel + DraftKings carry season-long markets in practice;
//    Pinnacle/BetMGM importer extension tracked in follow-up.
//
// Returns: Map<`${pid}__${date_iso}`, implied_season_fp>

const SEASON_MARKETS = [
  'SEASON_PASSING_YARDS',
  'SEASON_PASSING_TOUCHDOWNS',
  'SEASON_RUSHING_YARDS',
  'SEASON_RUSHING_TOUCHDOWNS',
  'SEASON_RECEIVING_YARDS',
  'SEASON_RECEIVING_TOUCHDOWNS',
  'SEASON_RECEPTIONS'
]

const scoring_multiplier = (market_type, scoring) => {
  switch (market_type) {
    case 'SEASON_PASSING_YARDS':       return Number(scoring.py)    || 0
    case 'SEASON_PASSING_TOUCHDOWNS':  return Number(scoring.tdp)   || 0
    case 'SEASON_RUSHING_YARDS':       return Number(scoring.ry)    || 0
    case 'SEASON_RUSHING_TOUCHDOWNS':  return Number(scoring.tdr)   || 0
    case 'SEASON_RECEIVING_YARDS':     return Number(scoring.recy)  || 0
    case 'SEASON_RECEIVING_TOUCHDOWNS':return Number(scoring.tdrec) || 0
    case 'SEASON_RECEPTIONS':          return Number(scoring.rec)   || 0
    default:                           return 0
  }
}

export const extract_props_per_asset = async ({
  player_ids,
  scoring_format_hash,
  start_date,
  end_date
}) => {
  const result = new Map()
  if (!player_ids.length) return result

  const scoring = await db('league_scoring_formats')
    .where('scoring_format_hash', scoring_format_hash)
    .first()
  if (!scoring) return result

  // Resolve player from prop_market_selections_index, filter markets via prop_markets_index,
  // pull line snapshots from prop_market_selections_history.
  const rows = await db('prop_market_selections_history as h')
    .select(
      's.selection_pid as pid',
      'm.market_type',
      db.raw("TO_CHAR(TO_TIMESTAMP(h.timestamp), 'YYYY-MM-DD') AS date_iso"),
      'h.source_id',
      'h.selection_metric_line as line'
    )
    .innerJoin('prop_market_selections_index as s', function () {
      this.on('s.source_id', '=', 'h.source_id')
        .andOn('s.source_market_id', '=', 'h.source_market_id')
        .andOn('s.source_selection_id', '=', 'h.source_selection_id')
    })
    .innerJoin('prop_markets_index as m', function () {
      this.on('m.source_id', '=', 'h.source_id')
        .andOn('m.source_market_id', '=', 'h.source_market_id')
    })
    .whereIn('m.market_type', SEASON_MARKETS)
    .whereIn('s.selection_pid', player_ids)
    .where('h.timestamp', '>=', Math.floor(new Date(start_date).getTime() / 1000))
    .where('h.timestamp', '<=', Math.floor(new Date(end_date).getTime() / 1000) + 86400)
    .whereNotNull('h.selection_metric_line')

  // Bucket by (pid, date, market_type) -> median line across books
  const cell = new Map()
  for (const r of rows) {
    const k = `${r.pid}__${r.date_iso}__${r.market_type}`
    if (!cell.has(k)) cell.set(k, [])
    cell.get(k).push(Number(r.line))
  }

  // Aggregate: median line per market * scoring multiplier, summed per (pid, date)
  const per_pid_date = new Map()
  for (const [k, lines] of cell) {
    const [pid, date_iso, market_type] = k.split('__')
    const median_line = median(lines)
    const fp = median_line * scoring_multiplier(market_type, scoring)
    const out_key = `${pid}__${date_iso}`
    per_pid_date.set(out_key, (per_pid_date.get(out_key) || 0) + fp)
  }

  for (const [k, v] of per_pid_date) result.set(k, v)
  return result
}

export default extract_props_per_asset
