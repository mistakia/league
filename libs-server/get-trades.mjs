import db from '#db'

export default async function ({ lid, year = null }) {
  const trade_query = db('trades')
    .where({ lid })
    .orderBy('accepted', 'asc')
    .whereNotNull('accepted')

  if (year) {
    trade_query.where({ season_year: year })
  }

  const trades = await trade_query

  const trade_ids = trades.map((t) => t.uid)

  const trade_picks = await db('trades_picks').whereIn('trade_id', trade_ids)

  const trade_players = await db('trades_players').whereIn(
    'trade_id',
    trade_ids
  )

  const trade_transactions = await db('trades_transactions').whereIn(
    'trade_id',
    trade_ids
  )

  for (const trade of trades) {
    trade.picks = trade_picks.filter((p) => p.trade_id === trade.uid)
    trade.players = trade_players.filter((p) => p.trade_id === trade.uid)
    trade.transactions = trade_transactions.filter(
      (t) => t.trade_id === trade.uid
    )
  }

  return trades
}
