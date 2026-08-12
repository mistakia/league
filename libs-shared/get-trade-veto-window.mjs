/**
 * When a trade stops being vetoable. Pure arithmetic on the trade row and the
 * league setting, so the client can render a countdown that agrees exactly with
 * the window the server enforces.
 *
 * The asset freeze this window implies is server-side only — see
 * libs-server/get-trade-veto-window.mjs.
 *
 * A commissioner can also close the window ahead of the clock by approving the
 * trade, which `is_trade_within_veto_window` reads. `get_trade_veto_deadline`
 * stays pure arithmetic on `accepted` and the league setting, so the two
 * questions — when would the clock have closed this, and is it still open —
 * remain separable.
 */

import timestamptz_to_epoch from './timestamptz-to-epoch.mjs'

const get_window_hours = (league) => {
  const hours = Number(league?.trade_veto_window_hours)
  return Number.isFinite(hours) && hours > 0 ? hours : 0
}

/**
 * @returns {number|null} unix timestamp the trade stops being vetoable, or null
 * if the league has veto disabled or the trade was never accepted.
 */
export const get_trade_veto_deadline = ({ trade, league }) => {
  const hours = get_window_hours(league)
  if (!hours || !trade?.accepted) return null
  // `trades.accepted` is timestamptz, so `Number()` of it would yield
  // MILLISECONDS and push every deadline ~1000x into the future without
  // throwing. This helper is isomorphic: the server reads a Date from node-pg
  // and the client reads the ISO string it became over JSON, and
  // timestamptz_to_epoch accepts either.
  return timestamptz_to_epoch(trade.accepted) + hours * 3600
}

export const is_trade_within_veto_window = ({ trade, league, now }) => {
  if (trade?.vetoed) return false
  // The commissioner closed the window early; the trade is settled and its
  // assets are already unlocked.
  if (trade?.approved) return false
  const deadline = get_trade_veto_deadline({ trade, league })
  if (!deadline) return false
  const at = now === undefined ? Math.round(Date.now() / 1000) : now
  return at < deadline
}

export default get_trade_veto_deadline
