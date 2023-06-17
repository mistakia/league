import db from '#db'

export default async function ({ lid, accepted = true }) {
  const trades = await db('trades')
    .where({ lid })
    .orderBy('accepted', 'asc')
    .whereNotNull('accepted')

  const trade_ids = trades.map((t) => t.uid)

  const trade_picks = await db('trades_picks').whereIn('tradeid', trade_ids)

  const trade_players = await db('trades_players').whereIn('tradeid', trade_ids)

  const trade_transactions = await db('trades_transactions').whereIn(
    'tradeid',
    trade_ids
  )

  for (const trade of trades) {
    trade.picks = trade_picks.filter((p) => p.tradeid === trade.uid)
    trade.players = trade_players.filter((p) => p.tradeid === trade.uid)
    trade.transactions = trade_transactions.filter(
      (t) => t.tradeid === trade.uid
    )
  }

  return trades
}
