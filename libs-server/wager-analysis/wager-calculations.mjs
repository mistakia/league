// @ts-check
import oddslib from '#libs-server/odds-conversions.mjs'

/**
 * The decorated shapes this module works over. Neither is a raw table row:
 * `placed_wagers` carries `selections` as opaque JSON and stores amounts under
 * different names, so these describe what the wager-analysis pipeline has
 * already built by the time it reaches here.
 *
 * @typedef {object} WagerSelection
 * @property {number} event_id
 * @property {number} selection_id
 * @property {boolean} [is_lost]
 * @property {boolean} [is_won]
 * @property {number} [parsed_odds]
 *
 * @typedef {object} Wager
 * @property {WagerSelection[]} selections
 * @property {boolean} is_settled
 * @property {boolean} [is_won]
 * @property {boolean} [is_cashed_out]
 * @property {number} [bonus_bet_amount]
 * @property {number} [parsed_odds]
 * @property {number} stake
 * @property {number} [actual_return]
 * @property {number} potential_win
 */

/**
 * Odds buckets in ascending order: a wager counts in the first bucket whose
 * upper bound its price is below. The keys are the field names the summary
 * reports and the exposure formatter reads, so a new bucket is one row here.
 */
const ODDS_BUCKETS = [
  { key: 'under_100', upper_bound: 100 },
  { key: 'range_100_400', upper_bound: 400 },
  { key: 'range_400_1000', upper_bound: 1000 },
  { key: 'range_1000_10000', upper_bound: 10000 },
  { key: 'range_10000_50000', upper_bound: 50000 },
  { key: 'range_50000_100000', upper_bound: 100000 },
  { key: 'range_100000_150000', upper_bound: 150000 },
  { key: 'range_150000_250000', upper_bound: 250000 },
  { key: 'range_250000_500000', upper_bound: 500000 },
  { key: 'range_500000_1000000', upper_bound: 1000000 },
  { key: 'over_1000000', upper_bound: Infinity }
]

/**
 * Count a wager's price in its odds bucket, returning a new counts object to
 * maintain immutability in the reducer.
 *
 * @param {Record<string, number>} counts
 * @param {number} wager_odds - American odds
 * @returns {Record<string, number>} Updated counts object
 */
const increment_odds_bucket = (counts, wager_odds) => {
  const bucket = ODDS_BUCKETS.find(
    ({ upper_bound }) => wager_odds < upper_bound
  )
  return bucket ? { ...counts, [bucket.key]: counts[bucket.key] + 1 } : counts
}

/**
 * The gross return, stake included, a wager contributes to the summary.
 *
 * `actual_return` is what the book really paid, so it wins wherever it is
 * known — except for a hypothetical win, where the wager really lost and paid
 * nothing, and only the potential payout can express what the excluded props
 * would have returned. Cashed out wagers report their settlement; open wagers
 * have none yet and contribute nothing.
 *
 * @param {object} params
 * @param {Wager} params.wager
 * @param {boolean} params.is_won
 * @param {boolean} params.is_lost
 * @param {boolean} params.is_hypothetical_win
 * @returns {number}
 */
const calculate_gross_return = ({
  wager,
  is_won,
  is_lost,
  is_hypothetical_win
}) => {
  if (is_won) {
    if (is_hypothetical_win) {
      return wager.potential_win || 0
    }
    return wager.actual_return ?? wager.potential_win ?? 0
  }
  if (is_lost) {
    return 0
  }
  return wager.actual_return || 0
}

/**
 * Helper to check if two props are equal.
 *
 * We don't compare market_id because FanDuel can assign different market IDs to
 * the same selection (same player, threshold, and outcome). The selection_id
 * combined with event_id is sufficient to uniquely identify a prop.
 *
 * @param {WagerSelection} prop_a
 * @param {WagerSelection} prop_b
 */
const is_prop_equal = (prop_a, prop_b) =>
  prop_a.event_id === prop_b.event_id &&
  prop_a.selection_id === prop_b.selection_id

/**
 * Update the count of wagers lost by a specific number of legs.
 * Creates a new object to maintain immutability in the reducer.
 *
 * @param {Record<number, number>} lost_by_legs - Current counts, keyed by leg count
 * @param {boolean} is_lost - Whether the wager was lost
 * @param {number} lost_legs - Number of losing selections in the wager
 * @returns {Record<number, number>} Updated counts object
 */
const update_lost_by_legs_count = (lost_by_legs, is_lost, lost_legs) => {
  const updated = { ...lost_by_legs }
  if (is_lost && lost_legs > 0) {
    updated[lost_legs] = (updated[lost_legs] || 0) + 1
  }
  return updated
}

/**
 * Calculate summary statistics for a collection of props.
 * @param {WagerSelection[]} props
 */
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

/**
 * Format metric result value for display.
 * @param {number | null | undefined} value
 */
export const format_metric_result = (value) => {
  if (value === null || value === undefined) {
    return '-'
  }
  return Number(value).toFixed(1)
}

/**
 * Format threshold distance with appropriate sign.
 * @param {number | null | undefined} distance
 */
export const format_threshold_distance = (distance) => {
  if (distance === null || distance === undefined) {
    return '-'
  }
  const formatted_distance = Number(distance).toFixed(1)
  return distance > 0 ? `+${formatted_distance}` : formatted_distance
}

/**
 * Convert American odds to fractional format for display (always X/1 format).
 * @param {number | null | undefined} american_odds
 */
export const format_american_odds_as_fractional = (american_odds) => {
  if (american_odds === null || american_odds === undefined) {
    return '-'
  }

  // Decimal odds carry the stake, so the profit ratio is decimal - 1:
  // decimal odds of 2.5 display as 1.50/1.
  const decimal_odds = oddslib.from('moneyline', american_odds).to('decimal')
  const profit_ratio = (decimal_odds - 1).toFixed(2)

  return `${profit_ratio}/1`
}

/**
 * Calculate summary statistics for a collection of wagers.
 * @param {object} params
 * @param {Wager[]} params.wagers
 * @param {WagerSelection[]} [params.props] - Selections to exclude from the
 *   lost-leg count, so a hypothetical can ask "what if these had hit".
 */
export const calculate_wager_summary = ({ wagers, props = [] }) =>
  wagers.reduce(
    (accumulator, wager) => {
      const lost_selections = wager.selections.filter(
        (selection) => selection.is_lost
      )
      const rescued_legs = lost_selections.filter((selection) =>
        props.some((prop) => is_prop_equal(selection, prop))
      ).length
      const lost_legs = lost_selections.length - rescued_legs

      const is_settled = wager.is_settled
      const is_cashed_out = wager.is_cashed_out || false

      // A win is either the book's own settlement or the counterfactual `props`
      // asks for — every leg that really lost was one of the excluded props.
      // Deriving it from the absence of a losing leg alone would also count a
      // settled wager whose legs all voided. Cashed out wagers are considered
      // settled but neither won nor lost.
      const is_won =
        is_settled &&
        !is_cashed_out &&
        lost_legs === 0 &&
        (Boolean(wager.is_won) || rescued_legs > 0)
      const is_lost = is_settled && !is_cashed_out && lost_legs > 0
      const is_hypothetical_win = is_won && rescued_legs > 0

      const gross_return = calculate_gross_return({
        wager,
        is_won,
        is_lost,
        is_hypothetical_win
      })

      // Track bonus bet amounts
      const bonus_bet_amount = wager.bonus_bet_amount || 0

      // Odds of 0 are not a price a book can offer, so they mean the wager
      // carries none; such a wager is left out of the odds statistics rather
      // than counted as a real "< +100" price that drags the average down.
      const wager_odds = wager.parsed_odds || null

      return {
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
        // total_won = profit only, the gross return less the stake it risked,
        // so it is money won rather than money returned
        total_won:
          is_won || is_cashed_out
            ? accumulator.total_won + gross_return - wager.stake
            : accumulator.total_won,
        // total_return = stake + profit for settled wagers (used for ROI calculation)
        total_return: accumulator.total_return + gross_return,
        wagers_cashed_out: is_cashed_out
          ? accumulator.wagers_cashed_out + 1
          : accumulator.wagers_cashed_out,
        total_potential_win:
          accumulator.total_potential_win + (wager.potential_win || 0),
        open_potential_win: is_settled
          ? accumulator.open_potential_win
          : accumulator.open_potential_win + (wager.potential_win || 0),

        // Track max and average wager odds
        wagers_with_odds:
          wager_odds === null
            ? accumulator.wagers_with_odds
            : accumulator.wagers_with_odds + 1,
        wagers_odds_sum: accumulator.wagers_odds_sum + (wager_odds || 0),
        max_wager_odds:
          wager_odds !== null && wager_odds > accumulator.max_wager_odds
            ? wager_odds
            : accumulator.max_wager_odds,

        // Wagers by odds range
        wagers_by_odds_range:
          wager_odds === null
            ? accumulator.wagers_by_odds_range
            : increment_odds_bucket(
                accumulator.wagers_by_odds_range,
                wager_odds
              ),

        // Track lost legs dynamically - count wagers by number of losing selections
        lost_by_legs: update_lost_by_legs_count(
          accumulator.lost_by_legs,
          is_lost,
          lost_legs
        )
      }
    },
    {
      wagers: 0,
      wagers_won: 0,
      wagers_loss: 0,
      wagers_cashed_out: 0,
      total_risk: 0,
      bonus_bet_risk: 0,
      wagers_open: 0,
      total_won: 0,
      total_return: 0,
      total_potential_win: 0,
      open_potential_win: 0,
      wagers_with_odds: 0,
      wagers_odds_sum: 0,
      max_wager_odds: 0,
      wagers_by_odds_range: Object.fromEntries(
        ODDS_BUCKETS.map(({ key }) => [key, 0])
      ),
      lost_by_legs: {}
    }
  )
