import db from '#db'
import { transaction_types } from '#constants/transaction-constants.mjs'

import { LAST_RESET_EVENT } from './constants.mjs'

// Denormalize player_team_extension_state per (lid, tid, pid) by walking the
// transactions ledger. Counts cumulative EXTENSION transactions, captures
// FRANCHISE_TAG history years, the (singular) ROOKIE_TAG year, and the most
// recent reset event (RFA_WIN | RELEASE | TRADED_AWAY).
//
// Reset semantics: extension_count resets to 0 when a player is released or
// changes teams via RFA win / trade. Subsequent extensions accumulate fresh.

// Reset semantics:
//   ROSTER_RELEASE  -> reset on tid recorded in transactions (the releasing team).
//   RESTRICTED_FREE_AGENCY_TAG -> reset only on the losing team (player_tid),
//                                  and only when the win was cross-team
//                                  (tid != player_tid). The new team starts fresh.
//   TRADE                       -> the transactions ledger records the receiving
//                                  team only; resets must be applied to the
//                                  losing team, sourced from trades_players.tid.
const SIMPLE_RESET_TRANSACTION_TYPES = new Set([
  transaction_types.ROSTER_RELEASE
])

const refresh_extension_state = async ({ lid, affected_keys = null }) => {
  // affected_keys: optional set of "tid__pid" to limit refresh scope; if null,
  // recompute every (tid, pid) present in transactions for this lid.

  const transactions = await db('transactions')
    .select('uid', 'tid', 'pid', 'type', 'year', 'timestamp')
    .where('lid', lid)
    .orderBy('timestamp', 'asc')

  // Cross-team RFA wins: source of TRADED_AWAY-style reset on the losing team.
  const rfa_wins = await db('restricted_free_agency_bids')
    .select('pid', 'tid', 'player_tid', 'processed')
    .where({ lid, succ: true })
    .whereNotNull('processed')

  // Trade legs: a player listed in trades_players with tid=losing team needs
  // a TRADED_AWAY reset at the trade timestamp.
  const trade_legs = await db('trades_players')
    .join('trades', 'trades.uid', 'trades_players.tradeid')
    .where('trades.lid', lid)
    .whereNotNull('trades.accepted')
    .select(
      'trades_players.pid',
      'trades_players.tid',
      'trades.accepted as ts'
    )

  // Build a unified reset stream keyed by ts so chronological ordering with
  // extension/tag accumulation matches reality.
  const reset_events = []
  for (const tran of transactions) {
    if (!tran.pid) continue
    if (SIMPLE_RESET_TRANSACTION_TYPES.has(tran.type)) {
      reset_events.push({
        ts: tran.timestamp,
        tid: tran.tid,
        pid: tran.pid,
        event: LAST_RESET_EVENT.RELEASE
      })
    }
  }
  for (const r of rfa_wins) {
    if (r.tid === r.player_tid) continue
    reset_events.push({
      ts: r.processed,
      tid: r.player_tid,
      pid: r.pid,
      event: LAST_RESET_EVENT.RFA_WIN
    })
  }
  for (const t of trade_legs) {
    reset_events.push({
      ts: t.ts,
      tid: t.tid,
      pid: t.pid,
      event: LAST_RESET_EVENT.TRADED_AWAY
    })
  }
  reset_events.sort((a, b) => a.ts - b.ts)

  const state_by_key = new Map()
  const ensure = (tid, pid) => {
    const key = `${tid}__${pid}`
    if (!state_by_key.has(key)) {
      state_by_key.set(key, {
        lid,
        tid,
        pid,
        extension_count: 0,
        franchise_tag_history_years: [],
        rookie_tag_used_year: null,
        last_reset_event: null,
        last_event_ts: 0
      })
    }
    return state_by_key.get(key)
  }

  const apply_reset = ({ tid, pid, event, ts }) => {
    const state = ensure(tid, pid)
    state.extension_count = 0
    state.last_reset_event = event
    if (ts > state.last_event_ts) state.last_event_ts = ts
  }

  // Merge-walk transactions (accumulation) and reset_events (zeroing) in ts order.
  let ri = 0
  for (const tran of transactions) {
    if (!tran.pid) continue
    while (ri < reset_events.length && reset_events[ri].ts <= tran.timestamp) {
      apply_reset(reset_events[ri])
      ri += 1
    }
    const state = ensure(tran.tid, tran.pid)
    if (tran.type === transaction_types.EXTENSION) {
      state.extension_count += 1
    } else if (tran.type === transaction_types.FRANCHISE_TAG) {
      if (!state.franchise_tag_history_years.includes(tran.year))
        state.franchise_tag_history_years.push(tran.year)
    } else if (tran.type === transaction_types.ROOKIE_TAG) {
      state.rookie_tag_used_year = tran.year
    }
  }
  while (ri < reset_events.length) {
    apply_reset(reset_events[ri])
    ri += 1
  }

  const now = new Date()
  const inserts = []
  for (const [key, state] of state_by_key) {
    if (affected_keys && !affected_keys.has(key)) continue
    inserts.push({
      lid: state.lid,
      tid: state.tid,
      pid: state.pid,
      extension_count: state.extension_count,
      franchise_tag_history_years: state.franchise_tag_history_years.length
        ? state.franchise_tag_history_years
        : null,
      rookie_tag_used_year: state.rookie_tag_used_year,
      last_reset_event: state.last_reset_event,
      last_refreshed_at: now
    })
  }
  if (!inserts.length) return 0

  await db('player_team_extension_state')
    .insert(inserts)
    .onConflict(['lid', 'tid', 'pid'])
    .merge()

  return inserts.length
}

export default refresh_extension_state
