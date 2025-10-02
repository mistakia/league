import * as oddslib from 'oddslib'

// Helper to check if two props are equal
// Note: We don't compare market_id because FanDuel can assign different market IDs
// to the same selection (same player, threshold, and outcome). The selection_id
// combined with event_id is sufficient to uniquely identify a prop.
const is_prop_equal = (prop_a, prop_b) =>
  prop_a.event_id === prop_b.event_id &&
  prop_a.selection_id === prop_b.selection_id

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
        total_won: is_won
          ? accumulator.total_won + wager.potential_win
          : accumulator.total_won,
        max_potential_win: accumulator.max_potential_win + wager.potential_win,
        open_potential_win: is_settled
          ? accumulator.open_potential_win
          : accumulator.open_potential_win + wager.potential_win,

        lost_by_one_leg:
          lost_legs === 1
            ? accumulator.lost_by_one_leg + 1
            : accumulator.lost_by_one_leg,
        lost_by_two_legs:
          lost_legs === 2
            ? accumulator.lost_by_two_legs + 1
            : accumulator.lost_by_two_legs,
        lost_by_three_legs:
          lost_legs === 3
            ? accumulator.lost_by_three_legs + 1
            : accumulator.lost_by_three_legs,
        lost_by_four_or_more_legs:
          lost_legs >= 4
            ? accumulator.lost_by_four_or_more_legs + 1
            : accumulator.lost_by_four_or_more_legs
      }
    },
    {
      won_wagers: [],
      wagers: 0,
      wagers_won: 0,
      wagers_loss: 0,
      total_risk: 0,
      wagers_open: 0,
      total_won: 0,
      max_potential_win: 0,
      open_potential_win: 0,
      lost_by_one_leg: 0,
      lost_by_two_legs: 0,
      lost_by_three_legs: 0,
      lost_by_four_or_more_legs: 0
    }
  )
