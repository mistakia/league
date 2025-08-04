import db from '#db'

export default async function get_draft_data_with_history({ lid, year }) {
  // Get draft picks for the specified league and year
  const picks = await db('draft').where({ lid, year })

  // Build trade history for each pick
  const trade_history_by_pick = {}

  // Get all trades that involved any of these picks
  const pick_ids = picks.map((pick) => pick.uid)

  if (pick_ids.length > 0) {
    // Get trades involving these picks (accepted trades only)
    const trades_with_picks = await db('trades')
      .join('trades_picks', 'trades.uid', 'trades_picks.tradeid')
      .whereIn('trades_picks.pickid', pick_ids)
      .whereNotNull('trades.accepted')
      .select(
        'trades.*',
        'trades_picks.pickid',
        'trades_picks.tid as pick_recipient_tid'
      )
      .orderBy('trades.accepted', 'asc')

    // Get additional trade details for these trades
    const trade_ids = [...new Set(trades_with_picks.map((t) => t.uid))]

    if (trade_ids.length > 0) {
      const trade_players = await db('trades_players').whereIn(
        'tradeid',
        trade_ids
      )
      const trade_picks_all = await db('trades_picks').whereIn(
        'tradeid',
        trade_ids
      )

      // Organize trade history by pick ID
      for (const pick_id of pick_ids) {
        const pick_trades = trades_with_picks.filter(
          (t) => t.pickid === pick_id
        )

        // Build complete trade chain for this pick
        const trade_chain = []
        for (const trade of pick_trades) {
          const trade_data = {
            uid: trade.uid,
            propose_tid: trade.propose_tid,
            accept_tid: trade.accept_tid,
            accepted: trade.accepted,
            year: trade.year,
            pick_recipient_tid: trade.pick_recipient_tid,
            players: trade_players.filter((p) => p.tradeid === trade.uid),
            picks: trade_picks_all.filter((p) => p.tradeid === trade.uid)
          }
          trade_chain.push(trade_data)
        }

        if (trade_chain.length > 0) {
          trade_history_by_pick[pick_id] = trade_chain
        }
      }
    }
  }

  // Get historical data for each pick position
  const historical_by_position = {}
  const max_pick = Math.max(...picks.map((p) => p.pick || 0))

  // Get historical picks for each position across multiple years
  for (let position = 1; position <= max_pick; position++) {
    const historical_picks = await db('draft')
      .where({ lid, pick: position })
      .whereNotNull('pid') // Only picks that were actually made
      .where('year', '<', year) // Previous years only
      .orderBy('year', 'desc')

    if (historical_picks.length > 0) {
      historical_by_position[position] = historical_picks
    }
  }

  return {
    picks,
    trade_history_by_pick,
    historical_by_position
  }
}
