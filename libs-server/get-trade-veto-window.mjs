import db from '#db'
import {
  get_trade_veto_deadline,
  is_trade_within_veto_window
} from '#libs-shared/get-trade-veto-window.mjs'

/**
 * Assets moved by a recently accepted trade are frozen until that trade's veto
 * window closes. The freeze is what makes a veto cleanly reversible: while it
 * holds, no traded player, released player or pick can change hands again, so a
 * reversal never has to unwind a third team's decision.
 *
 * Derived from `trades` on every call rather than materialized onto the assets.
 * The trade row is already the source of truth for when the window opened
 * (`accepted`), whether it is still open (`vetoed`), and whether the
 * commissioner closed it early (`approved`), so a second copy could only drift.
 *
 * An approved trade is settled: the commissioner ended its window ahead of the
 * clock, so its assets unlock here on the very next call with no cleanup step.
 */

// The window arithmetic itself is shared with the client, which renders a
// countdown against the same deadline this module freezes assets until.
export { get_trade_veto_deadline, is_trade_within_veto_window }

const get_window_hours = (league) => {
  const hours = Number(league?.trade_veto_window_hours)
  return Number.isFinite(hours) && hours > 0 ? hours : 0
}

/**
 * Look up which of the given assets are frozen by an open veto window.
 *
 * @param {object} params
 * @param {object} params.league league row, for the window length
 * @param {string[]} [params.pids] player ids to test
 * @param {number[]} [params.pickids] draft pick ids to test
 * @returns {Promise<{pids: Map<string, object>, pickids: Map<number, object>}>}
 *   maps of frozen asset to { trade_id, protected_until }
 */
export const get_trade_protected_assets = async ({
  league,
  pids = [],
  pickids = []
}) => {
  const empty = { pids: new Map(), pickids: new Map() }

  const hours = get_window_hours(league)
  if (!hours) return empty
  if (!pids.length && !pickids.length) return empty

  const now = Math.round(Date.now() / 1000)
  const accepted_after = new Date((now - hours * 3600) * 1000)

  const open_trades = await db('trades')
    .where('lid', league.league_id)
    .whereNotNull('accepted')
    .whereNull('vetoed')
    .whereNull('approved')
    .where('accepted', '>', accepted_after)

  if (!open_trades.length) return empty

  const trade_by_id = new Map(open_trades.map((t) => [t.trade_id, t]))
  const tradeids = [...trade_by_id.keys()]
  // Delegates rather than restating the arithmetic: `accepted` is timestamptz,
  // so the open-coded `Number(...) + hours * 3600` here was reading milliseconds
  // as seconds, and a second copy of the deadline formula could drift from the
  // one the client renders its countdown against.
  const protected_until = (trade_id) =>
    get_trade_veto_deadline({ trade: trade_by_id.get(trade_id), league })

  const result = { pids: new Map(), pickids: new Map() }

  if (pids.length) {
    // Released players are frozen too: a veto has to put them back on the
    // roster they were cut from, which is impossible if someone has signed them.
    const [traded_rows, released_rows] = await Promise.all([
      db('trades_players').whereIn('trade_id', tradeids).whereIn('pid', pids),
      db('trade_releases').whereIn('trade_id', tradeids).whereIn('pid', pids)
    ])

    for (const row of [...traded_rows, ...released_rows]) {
      if (result.pids.has(row.pid)) continue
      result.pids.set(row.pid, {
        trade_id: row.trade_id,
        protected_until: protected_until(row.trade_id)
      })
    }
  }

  if (pickids.length) {
    const pick_rows = await db('trades_picks')
      .whereIn('trade_id', tradeids)
      .whereIn('draft_pick_id', pickids)

    for (const row of pick_rows) {
      if (result.pickids.has(row.draft_pick_id)) continue
      result.pickids.set(row.draft_pick_id, {
        trade_id: row.trade_id,
        protected_until: protected_until(row.trade_id)
      })
    }
  }

  return result
}

/**
 * Throws if any of the given assets is frozen by an open veto window. Call this
 * from anything that changes who owns a player or a pick.
 */
export const verify_assets_not_trade_protected = async ({
  league,
  pids = [],
  pickids = []
}) => {
  const { pids: frozen_pids, pickids: frozen_pickids } =
    await get_trade_protected_assets({ league, pids, pickids })

  if (frozen_pids.size) {
    const [pid, info] = [...frozen_pids.entries()][0]
    throw new Error(
      `player ${pid} was traded in trade #${info.trade_id} and is locked until that trade's veto window closes`
    )
  }

  if (frozen_pickids.size) {
    const [draft_pick_id, info] = [...frozen_pickids.entries()][0]
    throw new Error(
      `draft pick ${draft_pick_id} was traded in trade #${info.trade_id} and is locked until that trade's veto window closes`
    )
  }
}

export default get_trade_protected_assets
