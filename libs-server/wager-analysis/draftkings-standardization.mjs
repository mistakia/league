import dayjs from 'dayjs'

import { constants, format_player_name } from '#libs-shared'

// Extract player name from DraftKings market display name
const extract_draftkings_player_name = (market_display_name) => {
  // List of stat names to check for
  const stat_names = [
    'Rushing Yards',
    'Receiving Yards',
    'Passing Yards',
    'Receptions',
    'Touchdowns'
  ]

  // Extract player name
  const player_name = stat_names.reduce((name, stat) => {
    if (name) return name
    const index = market_display_name.indexOf(stat)
    return index !== -1 ? market_display_name.slice(0, index).trim() : ''
  }, '')

  return player_name
}

// Format DraftKings selection name for display
const format_draftkings_selection_name = ({ selection }) => {
  // Handle nested SGP selections (2+ selections)
  if (
    selection.nestedSGPSelections &&
    selection.nestedSGPSelections.length > 0
  ) {
    const formatted_selections = selection.nestedSGPSelections.map((nested) => {
      const nested_market_display = nested.marketDisplayName || ''
      const nested_selection_display = nested.selectionDisplayName || ''

      const player_name = extract_draftkings_player_name(nested_market_display)

      // Handle team markets
      if (!player_name) {
        return nested_selection_display
      }

      // Handle anytime TD markets
      if (nested_market_display.includes('Anytime TD')) {
        return `${player_name} Anytime TD`
      }

      // Handle prop markets with handicap
      const stat = nested_market_display
        .replace(player_name, '')
        .trim()
        .replace('Rushing Yards', 'Rush Yds')
        .replace('Receiving Yards', 'Recv Yds')
        .replace('Passing Yards', 'Pass Yds')
        .replace('Receptions', 'Recs')

      // Use selectionDisplayName for the threshold (e.g., "25+")
      const handicap = nested_selection_display || ''

      return `${player_name} ${handicap} ${stat}`
    })

    return `SGP(${formatted_selections.join(' + ')})`
  }

  // Single selection handling
  const market_display = selection.marketDisplayName || ''
  const selection_display = selection.selectionDisplayName || ''

  const player_name = extract_draftkings_player_name(market_display)

  // Handle team markets or selections without player names
  if (!player_name) {
    // If we have a selection display name (like "30+"), try to extract stat from market
    if (selection_display) {
      const stat = market_display
        .replace('Passing Attempts', 'Pass Atts')
        .replace('Rushing Yards', 'Rush Yds')
        .replace('Receiving Yards', 'Recv Yds')
        .replace('Passing Yards', 'Pass Yds')
        .replace('Receptions', 'Recs')

      // Extract player name from the full market display for better formatting
      const words = market_display.split(' ')
      const full_player_name = words[0] + (words[1] ? ` ${words[1]}` : '')
      if (full_player_name && full_player_name !== market_display) {
        // Remove the player name from the stat to avoid duplication
        const clean_stat = stat.replace(full_player_name, '').trim()
        return `${full_player_name} ${selection_display} ${clean_stat}`
      }
      return `${selection_display} ${stat}`
    }
    return selection_display
  }

  // Handle anytime TD markets
  if (market_display.includes('Anytime TD')) {
    return `${player_name} Anytime TD`
  }

  // Handle prop markets with handicap
  const stat = market_display
    .replace(player_name, '')
    .trim()
    .replace('Rushing Yards', 'Rush Yds')
    .replace('Receiving Yards', 'Recv Yds')
    .replace('Passing Yards', 'Pass Yds')
    .replace('Passing Attempts', 'Pass Atts')
    .replace('Receptions', 'Recs')

  // Use selectionDisplayName for the threshold (e.g., "30+", "5+")
  const handicap = selection_display || ''

  return `${player_name} ${handicap} ${stat}`
}

// Extract player name from DraftKings selection
const format_draftkings_player_name = ({ selection }) => {
  const market_display_name = selection.marketDisplayName || ''

  const player_name = extract_draftkings_player_name(market_display_name)

  return format_player_name(player_name)
}

// Standardize DraftKings wager format
export const standardize_draftkings_wager = (wager) => {
  // Calculate week from settlement date
  const week = dayjs(wager.settlementDate)
    .subtract('2', 'day')
    .diff(constants.season.regular_season_start, 'weeks')

  if (wager.type === 'RoundRobin') {
    return wager.combinations.map((combination) => {
      const selections = combination.selectionsMapped.flatMap((selectionId) => {
        const selection =
          wager.selections.find((s) => s.selectionId === selectionId) ||
          wager.selections.find(
            (s) =>
              s.nestedSGPSelections &&
              s.nestedSGPSelections.some((ns) => ns.selectionId === selectionId)
          )

        if (!selection) {
          throw new Error(`Selection not found for ID: ${selectionId}`)
        }

        const standardize_selection = (sel) => ({
          name: format_draftkings_selection_name({
            selection: sel
          }),
          player_name: format_draftkings_player_name({ selection: sel }),
          event_id: sel.eventId,
          market_id: sel.marketId,
          selection_id: sel.selectionId,
          bet_receipt_id: wager.receiptId,
          source_id: 'DRAFTKINGS',
          result: sel.settlementStatus.toUpperCase(),
          parsed_odds: sel.displayOdds
            ? Number(sel.displayOdds.replace(/—|-|−/g, '-'))
            : null,
          is_won: sel.settlementStatus === 'Won',
          is_lost: sel.settlementStatus === 'Lost'
        })

        if (selection.nestedSGPSelections) {
          return selection.nestedSGPSelections.map(standardize_selection)
        } else {
          return [standardize_selection(selection)]
        }
      })

      const stake = wager.stake / wager.numberOfBets
      const parsed_odds = combination.displayOdds
        ? Number(combination.displayOdds.replace(/\+/g, ''))
        : combination.trueOdds

      const is_won = combination.status === 'Won'
      const is_lost = combination.status === 'Lost'

      return {
        ...wager,
        week,
        selections,
        bet_receipt_id: `${wager.receiptId}-${combination.id}`,
        parsed_odds,
        is_settled: wager.status === 'Settled' || is_lost || is_won,
        is_won,
        is_lost,
        potential_win: combination.potentialReturns,
        stake,
        is_bonus_bet: false,
        bonus_bet_amount: 0,
        source_id: 'DRAFTKINGS'
      }
    })
  } else {
    return {
      ...wager,
      week,
      selections: wager.selections.map((selection) => ({
        ...selection,
        name: format_draftkings_selection_name({ selection }),
        player_name: format_draftkings_player_name({ selection }),
        event_id: selection.eventId,
        market_id: selection.marketId,
        selection_id: selection.selectionId,
        bet_receipt_id: wager.betReceiptId,
        source_id: 'DRAFTKINGS',
        result: selection.settlementStatus.toUpperCase(),
        parsed_odds: selection.displayOdds
          ? Number(selection.displayOdds.replace(/—|-|−/g, '-'))
          : null,
        is_won: selection.settlementStatus === 'Won',
        is_lost: selection.settlementStatus === 'Lost'
      })),
      bet_receipt_id: wager.receiptId,
      parsed_odds: wager.displayOdds
        ? Number(wager.displayOdds.replace(/—|-|−/g, '-'))
        : null,
      is_settled: wager.status === 'Settled',
      is_won: wager.settlementStatus === 'Won',
      potential_win: wager.potentialReturns,
      stake: wager.stake,
      is_bonus_bet: false,
      bonus_bet_amount: 0,
      source_id: 'DRAFTKINGS'
    }
  }
}
