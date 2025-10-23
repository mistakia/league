import * as oddslib from 'oddslib'

// Helper to check if two props are equal
// Note: We don't compare market_id because FanDuel can assign different market IDs
// to the same selection (same player, threshold, and outcome). The selection_id
// combined with event_id is sufficient to uniquely identify a prop.
const is_prop_equal = (prop_a, prop_b) =>
  prop_a.event_id === prop_b.event_id &&
  prop_a.selection_id === prop_b.selection_id

/**
 * Update the count of wagers lost by a specific number of legs.
 * Creates a new object to maintain immutability in the reducer.
 *
 * @param {Object} lost_by_legs - Current counts object {1: count, 2: count, ...}
 * @param {boolean} is_lost - Whether the wager was lost
 * @param {number} lost_legs - Number of losing selections in the wager
 * @returns {Object} Updated counts object
 */
const update_lost_by_legs_count = (lost_by_legs, is_lost, lost_legs) => {
  const updated = { ...lost_by_legs }
  if (is_lost && lost_legs > 0) {
    updated[lost_legs] = (updated[lost_legs] || 0) + 1
  }
  return updated
}

// Calculate summary statistics for a collection of props
export const calculate_props_summary = (props) =>
  props.reduce(
    (accumulator, prop) => {
      const odds = prop.parsed_odds
        ? oddslib.from('moneyline', prop.parsed_odds).to('impliedProbability')
        : 0
      const is_win = prop.is_won
      return {
        total_selections: accumulator.total_selections + 1,
        market_implied_hits: accumulator.market_implied_hits + odds,
        actual_hits: is_win
          ? accumulator.actual_hits + 1
          : accumulator.actual_hits
      }
    },
    {
      market_implied_hits: 0,
      actual_hits: 0,
      total_selections: 0
    }
  )

// Format metric result value for display
export const format_metric_result = (value) => {
  if (value === null || value === undefined) {
    return '-'
  }
  return Number(value).toFixed(1)
}

// Format threshold distance with appropriate sign
export const format_threshold_distance = (distance, selection_type) => {
  if (distance === null || distance === undefined) {
    return '-'
  }
  const formatted_distance = Number(distance).toFixed(1)
  return distance > 0 ? `+${formatted_distance}` : formatted_distance
}

// Convert American odds to fractional format for display (always X/1 format)
export const format_american_odds_as_fractional = (american_odds) => {
  if (american_odds === null || american_odds === undefined) {
    return '-'
  }

  try {
    // Convert American odds to decimal odds first
    const decimal_odds = oddslib.from('moneyline', american_odds).to('decimal')

    // Convert decimal to X/1 fractional format
    // Decimal odds of 2.5 = 1.5/1 profit ratio
    const profit_ratio = (decimal_odds - 1).toFixed(2)

    return `${profit_ratio}/1`
  } catch (error) {
    // Fallback to American odds if conversion fails
    return american_odds > 0 ? `+${american_odds}` : american_odds
  }
}

// Calculate summary statistics for a collection of wagers
export const calculate_wager_summary = ({ wagers, props = [] }) =>
  wagers.reduce(
    (accumulator, wager) => {
      const lost_legs = wager.selections.filter((selection) => {
        for (const prop of props) {
          if (is_prop_equal(selection, prop)) {
            return false
          }
        }
        return selection.is_lost
      }).length

      const is_settled = wager.is_settled

      const is_won = is_settled && lost_legs === 0
      const is_lost = is_settled && lost_legs > 0

      // Track bonus bet amounts
      const bonus_bet_amount = wager.bonus_bet_amount || 0

      // Track wager odds
      const wager_odds = wager.parsed_odds || 0

      // Categorize wagers by odds ranges
      const odds_categories = {}
      if (wager_odds < 100) {
        odds_categories.under_100 = 1
      } else if (wager_odds >= 100 && wager_odds < 400) {
        odds_categories.range_100_400 = 1
      } else if (wager_odds >= 400 && wager_odds < 1000) {
        odds_categories.range_400_1000 = 1
      } else if (wager_odds >= 1000 && wager_odds < 10000) {
        odds_categories.range_1000_10000 = 1
      } else if (wager_odds >= 10000 && wager_odds < 50000) {
        odds_categories.range_10000_50000 = 1
      } else if (wager_odds >= 50000 && wager_odds < 100000) {
        odds_categories.range_50000_100000 = 1
      } else if (wager_odds >= 100000 && wager_odds < 150000) {
        odds_categories.range_100000_150000 = 1
      } else if (wager_odds >= 150000 && wager_odds < 250000) {
        odds_categories.range_150000_250000 = 1
      } else if (wager_odds >= 250000 && wager_odds < 500000) {
        odds_categories.range_250000_500000 = 1
      } else if (wager_odds >= 500000 && wager_odds < 1000000) {
        odds_categories.range_500000_1000000 = 1
      } else if (wager_odds >= 1000000) {
        odds_categories.over_1000000 = 1
      }

      return {
        won_wagers: is_won
          ? [...accumulator.won_wagers, wager]
          : accumulator.won_wagers,
        wagers: accumulator.wagers + 1,
        wagers_won: is_won
          ? accumulator.wagers_won + 1
          : accumulator.wagers_won,
        wagers_loss: is_lost
          ? accumulator.wagers_loss + 1
          : accumulator.wagers_loss,
        wagers_open: is_settled
          ? accumulator.wagers_open
          : accumulator.wagers_open + 1,

        total_risk: accumulator.total_risk + wager.stake,
        bonus_bet_risk: accumulator.bonus_bet_risk + bonus_bet_amount,
        total_won: is_won
          ? accumulator.total_won + wager.potential_win
          : accumulator.total_won,
        max_potential_win: accumulator.max_potential_win + wager.potential_win,
        open_potential_win: is_settled
          ? accumulator.open_potential_win
          : accumulator.open_potential_win + wager.potential_win,

        // Track max and average wager odds
        wagers_odds_sum: accumulator.wagers_odds_sum + wager_odds,
        max_wager_odds:
          wager_odds > accumulator.max_wager_odds
            ? wager_odds
            : accumulator.max_wager_odds,

        // Wagers by odds range
        wagers_by_odds_range: {
          under_100:
            accumulator.wagers_by_odds_range.under_100 +
            (odds_categories.under_100 || 0),
          range_100_400:
            accumulator.wagers_by_odds_range.range_100_400 +
            (odds_categories.range_100_400 || 0),
          range_400_1000:
            accumulator.wagers_by_odds_range.range_400_1000 +
            (odds_categories.range_400_1000 || 0),
          range_1000_10000:
            accumulator.wagers_by_odds_range.range_1000_10000 +
            (odds_categories.range_1000_10000 || 0),
          range_10000_50000:
            accumulator.wagers_by_odds_range.range_10000_50000 +
            (odds_categories.range_10000_50000 || 0),
          range_50000_100000:
            accumulator.wagers_by_odds_range.range_50000_100000 +
            (odds_categories.range_50000_100000 || 0),
          range_100000_150000:
            accumulator.wagers_by_odds_range.range_100000_150000 +
            (odds_categories.range_100000_150000 || 0),
          range_150000_250000:
            accumulator.wagers_by_odds_range.range_150000_250000 +
            (odds_categories.range_150000_250000 || 0),
          range_250000_500000:
            accumulator.wagers_by_odds_range.range_250000_500000 +
            (odds_categories.range_250000_500000 || 0),
          range_500000_1000000:
            accumulator.wagers_by_odds_range.range_500000_1000000 +
            (odds_categories.range_500000_1000000 || 0),
          over_1000000:
            accumulator.wagers_by_odds_range.over_1000000 +
            (odds_categories.over_1000000 || 0)
        },

        // Track lost legs dynamically - count wagers by number of losing selections
        lost_by_legs: update_lost_by_legs_count(
          accumulator.lost_by_legs,
          is_lost,
          lost_legs
        )
      }
    },
    {
      won_wagers: [],
      wagers: 0,
      wagers_won: 0,
      wagers_loss: 0,
      total_risk: 0,
      bonus_bet_risk: 0,
      wagers_open: 0,
      total_won: 0,
      max_potential_win: 0,
      open_potential_win: 0,
      wagers_odds_sum: 0,
      max_wager_odds: 0,
      wagers_by_odds_range: {
        under_100: 0,
        range_100_400: 0,
        range_400_1000: 0,
        range_1000_10000: 0,
        range_10000_50000: 0,
        range_50000_100000: 0,
        range_100000_150000: 0,
        range_150000_250000: 0,
        range_250000_500000: 0,
        range_500000_1000000: 0,
        over_1000000: 0
      },
      lost_by_legs: {}
    }
  )
