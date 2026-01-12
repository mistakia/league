import dayjs from 'dayjs'

import { format_player_name } from '#libs-shared'
import { current_season } from '#constants'
import { get_market_type } from '#libs-server/fanduel/fanduel-market-types.mjs'
import { extract_player_name_from_event_market_description } from '#libs-server/fanduel/fanduel-formatters.mjs'

// Helper function to generate combinations for round robin bets
const generate_round_robin_combinations = (arr, r) => {
  const combinations = []
  const combine = (start, combo) => {
    if (combo.length === r) {
      combinations.push(combo)
      return
    }
    for (let i = start; i < arr.length; i++) {
      combine(i + 1, [...combo, arr[i]])
    }
  }
  combine(0, [])
  return combinations
}

// Format FanDuel selection name for display
const format_fanduel_selection_name = ({ selection, week }) => {
  const player_name = extract_player_name_from_event_market_description(
    selection.eventMarketDescription
  )
  const stat_type = (
    selection.eventMarketDescription.includes(' - ')
      ? selection.eventMarketDescription.split(' - ')[1]
      : selection.eventMarketDescription
  )
    .replace('Alt ', '')
    .trim()
    .replace('Receptions', 'Recs')
    .replace('Passing', 'Pass')
    .replace('Rushing', 'Rush')
    .replace('Receiving', 'Recv')
    .replace('Any Time Touchdown Scorer', 'Anytime TD')
    .replace('To Score 2+ Touchdowns', '2+ TDs')
    .replace('1st Team Touchdown Scorer', '1st Team TD')
    .replace('Anytime Touchdown Scorer', 'Anytime TD')

  // Handle "Either Player" markets specially
  if (player_name === 'Either Player') {
    return `${selection.selectionName} ${stat_type}`
  }

  const handicap = Math.round(Number(selection.parsedHandicap))

  let name

  // Check if handicap is NaN or if it's a non-handicap market
  if (
    isNaN(handicap) ||
    stat_type === 'Moneyline' ||
    stat_type === 'Anytime TD' ||
    stat_type === '2+ TDs' ||
    stat_type === '1st Team TD'
  ) {
    name = `${selection.selectionName} ${stat_type}`
  } else if (stat_type === 'Alternate Spread') {
    name = `${selection.selectionName}`
  } else {
    name = `${player_name} ${handicap}+ ${stat_type}`
  }

  return name
}

// Extract player name from FanDuel selection
const format_fanduel_player_name = ({ selection }) => {
  const player_name = extract_player_name_from_event_market_description(
    selection.eventMarketDescription
  )
  return format_player_name(player_name)
}

// Calculate individual wagers from FanDuel round robin bet
const calculate_fanduel_round_robin_wager = ({ wager }) => {
  const num_selections = Number(wager.betType.slice(3))
  const legs = wager.legs

  // Generate all possible combinations
  const all_combinations = generate_round_robin_combinations(
    legs,
    num_selections
  )

  // Filter combinations to include only one selection per market and event
  const valid_combinations = all_combinations.filter((combination) => {
    const markets = new Set()
    const events = new Set()
    for (const leg of combination) {
      const market_id = leg.parts[0].marketId
      const event_id = leg.parts[0].eventId
      if (markets.has(market_id) || events.has(event_id)) {
        return false
      }
      markets.add(market_id)
      events.add(event_id)
    }
    return true
  })

  // Extract bonus bet information for round robin
  const is_bonus_bet = Boolean(wager.rewardUsed?.type === 'BONUS_BET')
  const bonus_bet_amount_total = is_bonus_bet ? wager.rewardUsed.balance : 0

  // Calculate potential win for each combination
  const stake_per_combination = wager.currentSize / valid_combinations.length
  const bonus_bet_per_combination =
    bonus_bet_amount_total / valid_combinations.length
  const round_robin_wagers = valid_combinations.map((combination) => {
    const odds_product = combination.reduce((product, leg) => {
      return product * (1 + Number(leg.parts[0].price) - 1)
    }, 1)
    const potential_win = stake_per_combination * odds_product

    const is_won = combination.every((leg) => leg.result === 'WON')
    const is_lost = combination.some((leg) => leg.result === 'LOST')
    // A combination is settled if: the overall wager is settled, all legs won, or any leg lost
    const is_settled = wager.isSettled || is_won || is_lost

    // Calculate actual_return for settled combinations
    // potential_win = stake * odds_product (total return including stake)
    const actual_return = is_won ? potential_win : is_lost ? 0 : null

    return {
      stake: stake_per_combination,
      potential_win,
      parsed_odds: (odds_product - 1) * 100, // Convert to American odds
      is_bonus_bet,
      bonus_bet_amount: bonus_bet_per_combination,
      selections: combination.map((leg) => ({
        ...leg.parts[0],
        name: format_fanduel_selection_name({
          selection: leg.parts[0],
          week: wager.week
        }),
        player_name: format_fanduel_player_name({ selection: leg.parts[0] }),
        event_id: leg.parts[0].eventId,
        market_id: leg.parts[0].marketId,
        market_type: get_market_type({
          marketType: leg.parts[0].marketType,
          marketName: ''
        }),
        source_id: 'FANDUEL',
        selection_id: leg.parts[0].selectionId,
        parsed_odds: Number(leg.parts[0].americanPrice),
        is_won: leg.result === 'WON',
        is_lost: leg.result === 'LOST'
      })),
      bet_receipt_id: `${wager.betReceiptId}-${combination.map((leg) => leg.parts[0].selectionId).join('-')}`,
      is_settled,
      is_won,
      is_lost,
      is_cashed_out: false, // Round robin combinations cannot be individually cashed out
      actual_return,
      source_id: 'FANDUEL'
    }
  })

  return round_robin_wagers
}

// Standardize FanDuel wager format
export const standardize_fanduel_wager = (wager) => {
  const week = dayjs(wager.settledDate)
    .subtract('2', 'day')
    .diff(current_season.regular_season_start, 'weeks')

  // check if the wager is a round robin
  if (wager.numLines > 1) {
    const round_robin_wagers = calculate_fanduel_round_robin_wager({
      wager: { ...wager, week }
    })
    return round_robin_wagers
  }

  // Extract bonus bet information
  const is_bonus_bet = Boolean(wager.rewardUsed?.type === 'BONUS_BET')
  const bonus_bet_amount = is_bonus_bet ? wager.rewardUsed.balance : 0

  return {
    ...wager,
    week,
    selections: wager.legs.map((leg) => ({
      ...leg.parts[0],
      name: format_fanduel_selection_name({ selection: leg.parts[0], week }),
      player_name: format_fanduel_player_name({ selection: leg.parts[0] }),
      event_id: leg.parts[0].eventId,
      market_id: leg.parts[0].marketId,
      market_type: get_market_type({
        marketType: leg.parts[0].marketType,
        marketName: ''
      }),
      source_id: 'FANDUEL',
      selection_id: leg.parts[0].selectionId,
      result: leg.result || 'OPEN',
      parsed_odds: Number(leg.parts[0].americanPrice),
      is_won: leg.result === 'WON',
      is_lost: leg.result === 'LOST'
    })),
    bet_receipt_id: wager.betReceiptId.replace(
      /(\d{4})(\d{4})(\d{4})(\d{4})/,
      '$1-$2-$3-$4'
    ),
    parsed_odds: Number(wager.americanBetPrice) || 0,
    is_settled: wager.isSettled,
    is_won: wager.result === 'WON',
    is_cashed_out: wager.result === 'CASHED_OUT',
    // betPrice is decimal odds; if missing, use potentialWin from wager or calculate from pandl
    potential_win:
      typeof wager.betPrice === 'number' && !isNaN(wager.betPrice)
        ? wager.betPrice * wager.currentSize
        : wager.potentialWin !== undefined && wager.potentialWin !== null
          ? Number(wager.potentialWin)
          : wager.pandl !== undefined && wager.pandl !== null
            ? wager.currentSize + wager.pandl
            : 0,
    actual_return:
      wager.result === 'WON'
        ? wager.currentSize + (wager.pandl || 0)
        : wager.result === 'CASHED_OUT'
          ? wager.currentSize + (wager.pandl || 0)
          : wager.result === 'LOST'
            ? 0
            : null,
    stake: wager.currentSize,
    is_bonus_bet,
    bonus_bet_amount,
    source_id: 'FANDUEL'
  }
}
