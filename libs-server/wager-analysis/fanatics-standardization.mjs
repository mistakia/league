import { fanatics } from '#libs-server'

// Standardize Fanatics wager format
export const standardize_fanatics_wager = (wager) => {
  const parlay_legs = wager.parlayLegs || []

  return {
    ...wager,
    selections: parlay_legs.map((leg) => ({
      name: `${leg.title} ${leg.subtitle}`,
      player_name: leg.title.split(' ')[0] + ' ' + leg.title.split(' ')[1],
      event_id: leg.metaData.eventId,
      market_id: leg.metaData.marketId,
      source_id: 'FANATICS',
      selection_id: leg.metaData.selectionId,
      result: leg.betStatus,
      parsed_odds: Number(leg.oddsData.americanDisplay.replace(/[+-]/g, '')),
      is_won: leg.betStatus === 'WON',
      is_lost: leg.betStatus === 'LOST'
    })),
    bet_receipt_id: wager.betMetaData.betId,
    parsed_odds: Number(wager.header.oddsData.americanDisplay),
    is_settled:
      wager.header.betStatus !== 'OPEN' && wager.header.betStatus !== 'NOT_SET',
    is_won: wager.header.betStatus === 'WON',
    potential_win: fanatics.format_wager_payout(wager.header.payout),
    stake: Number(wager.header.wager.replace('$', '')),
    is_bonus_bet: false,
    bonus_bet_amount: 0,
    source_id: 'FANATICS'
  }
}
