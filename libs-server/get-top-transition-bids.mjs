import db from '#db'
import { constants } from '#libs-shared'

export default async function (leagueId) {
  const current_timestamp = Math.round(Date.now() / 1000)
  const one_day_seconds = 24 * 60 * 60

  const active_rfa_players = await db('transition_bids')
    .where('lid', leagueId)
    .where('year', constants.season.year)
    .whereNotNull('announced')
    .where('announced', '<=', current_timestamp - one_day_seconds) // Ensure 24 hours have passed since announcement
    .whereNotExists(function () {
      this.select('*')
        .from('transition_bids as successful_bids')
        .whereRaw('successful_bids.pid = transition_bids.pid')
        .where('successful_bids.succ', true)
        .where('successful_bids.year', constants.season.year)
    })

  const active_rfa_pids = active_rfa_players.map((p) => p.pid)

  const transition_bid_rows = await db('transition_bids')
    .where('lid', leagueId)
    .where('year', constants.season.year)
    .whereIn('pid', active_rfa_pids)
    .whereNull('cancelled')
    .whereNull('processed')

  if (!transition_bid_rows.length) {
    return []
  }

  transition_bid_rows.forEach((t) => {
    // if competing bids, use bid amount
    if (t.player_tid !== t.tid) {
      t._bid = t.bid
      return
    }

    // boost original team bids by 20% or $2, whichever is greater
    const _20pct = Math.min(t.bid * 0.2)
    const boost = Math.max(2, _20pct)
    t._bid = t.bid + boost
  })

  // find highest transition bids
  const bid_amounts = transition_bid_rows.map((t) => t._bid)
  const max_bid = Math.max(...bid_amounts)
  const max_bids = transition_bid_rows.filter((t) => t._bid === max_bid)

  // if more than one, process player based on alphabetical order
  const max_pids = max_bids.map((p) => p.pid)
  const sorted_pids = max_pids.sort((a, b) => a - b)
  const top_pid = sorted_pids[0]
  return max_bids.filter((b) => b.pid === top_pid)
}
