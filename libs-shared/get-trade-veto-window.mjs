/**
 * When a trade stops being vetoable. Pure arithmetic on the trade row and the
 * league setting, so the client can render a countdown that agrees exactly with
 * the window the server enforces.
 *
 * The asset freeze this window implies is server-side only — see
 * libs-server/get-trade-veto-window.mjs.
 */

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
  return Number(trade.accepted) + hours * 3600
}

export const is_trade_within_veto_window = ({ trade, league, now }) => {
  if (trade?.vetoed) return false
  const deadline = get_trade_veto_deadline({ trade, league })
  if (!deadline) return false
  const at = now === undefined ? Math.round(Date.now() / 1000) : now
  return at < deadline
}

export default get_trade_veto_deadline
