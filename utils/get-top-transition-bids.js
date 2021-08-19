const db = require('../db')
const { constants } = require('../common')

module.exports = async (leagueId) => {
  const transitionBids = await db('transition_bids')
    .where('lid', leagueId)
    .where('year', constants.season.year)
    .whereNull('cancelled')
    .whereNull('processed')

  if (!transitionBids.length) {
    return []
  }

  transitionBids.forEach((t) => {
    if (t.player_tid !== t.tid) {
      t._bid = t.bid
      return
    }

    // boost original team bids
    const boost = Math.max(2, t.bid * 0.2)
    t._bid = t.bid + boost
  })

  const bidAmounts = transitionBids.map((t) => t._bid)
  const topBid = Math.max(...bidAmounts)
  const topBids = transitionBids.filter((t) => t._bid === topBid)
  const players = topBids.map((p) => p.player)
  const sortedPlayers = players.sort((a, b) => a - b)
  const topPlayer = sortedPlayers[0]
  return topBids.filter((b) => b.player === topPlayer)
}
