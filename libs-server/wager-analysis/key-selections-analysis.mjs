// Constants
const HIGH_ODDS_THRESHOLD = 180
const HIGH_EXPOSURE_THRESHOLD = 8

/**
 * Calculate key selections based on multiple criteria:
 * - High-odds winners (odds >= 180)
 * - Near-miss selections (in wagers lost by 1-3 legs)
 * - High exposure selections (exposure > 8%)
 *
 * For each key selection, tracks how many wagers lost by 1/2/3 legs contain it.
 *
 * @param {object} params
 * @param {Array} params.unique_selections - All unique selections with enriched data
 * @param {Array} params.filtered_wagers - All wagers to analyze
 * @param {number} params.total_wagers - Total number of wagers
 * @returns {Array} Array of key selections with near-miss counts
 */
export const calculate_key_selections = ({
  unique_selections,
  filtered_wagers,
  total_wagers
}) => {
  // Build a map of selection_key -> selection for quick lookup
  const selection_map = new Map()
  for (const selection of unique_selections) {
    const key = `${selection.event_id}/${selection.selection_id}/${selection.market_type || 'unknown'}`
    selection_map.set(key, selection)
  }

  // Build index of wagers by lost leg count
  const wagers_by_lost_legs = {
    1: [],
    2: [],
    3: []
  }

  for (const wager of filtered_wagers) {
    if (!wager.is_settled) continue

    const lost_legs = wager.selections.filter((s) => s.is_lost).length
    if (lost_legs >= 1 && lost_legs <= 3) {
      wagers_by_lost_legs[lost_legs].push(wager)
    }
  }

  // Calculate lost-by-N-legs counts for each selection
  const selection_near_miss_counts = new Map()

  for (const [lost_count, wagers] of Object.entries(wagers_by_lost_legs)) {
    for (const wager of wagers) {
      for (const selection of wager.selections) {
        const key = `${selection.event_id}/${selection.selection_id}/${selection.market_type || 'unknown'}`

        if (!selection_near_miss_counts.has(key)) {
          selection_near_miss_counts.set(key, {
            lost_by_1_count: 0,
            lost_by_2_count: 0,
            lost_by_3_count: 0
          })
        }

        const counts = selection_near_miss_counts.get(key)
        if (lost_count === '1') counts.lost_by_1_count++
        if (lost_count === '2') counts.lost_by_2_count++
        if (lost_count === '3') counts.lost_by_3_count++
      }
    }
  }

  // Identify key selections and build output
  const key_selections = []

  for (const selection of unique_selections) {
    const key = `${selection.event_id}/${selection.selection_id}/${selection.market_type || 'unknown'}`
    const near_miss_counts = selection_near_miss_counts.get(key) || {
      lost_by_1_count: 0,
      lost_by_2_count: 0,
      lost_by_3_count: 0
    }

    // Calculate exposure rate as percentage
    const exposure_rate_pct = parseFloat(selection.exposure_rate)

    // Determine selection criteria
    const is_high_odds_winner =
      selection.is_won && selection.parsed_odds >= HIGH_ODDS_THRESHOLD
    const is_near_miss =
      near_miss_counts.lost_by_1_count > 0 ||
      near_miss_counts.lost_by_2_count > 0 ||
      near_miss_counts.lost_by_3_count > 0
    const is_high_exposure = exposure_rate_pct > HIGH_EXPOSURE_THRESHOLD

    // Include if it meets any criteria
    if (is_high_odds_winner || is_near_miss || is_high_exposure) {
      const total_near_miss_count =
        near_miss_counts.lost_by_1_count +
        near_miss_counts.lost_by_2_count +
        near_miss_counts.lost_by_3_count

      key_selections.push({
        name: selection.name,
        odds: selection.parsed_odds,
        result: selection.is_won ? 'WON' : selection.is_lost ? 'LOST' : 'OPEN',
        exposure_rate: selection.exposure_rate,
        exposure_count: selection.exposure_count,
        threshold: selection.selection_metric_line,
        actual: selection.metric_result_value,
        diff: selection.distance_from_threshold,
        selection_type: selection.selection_type,
        lost_by_1_count: near_miss_counts.lost_by_1_count,
        lost_by_2_count: near_miss_counts.lost_by_2_count,
        lost_by_3_count: near_miss_counts.lost_by_3_count,
        total_near_miss_count,
        is_high_odds_winner,
        is_near_miss,
        is_high_exposure,
        // Keep selection identifiers for later use
        event_id: selection.event_id,
        selection_id: selection.selection_id,
        source_id: selection.source_id,
        market_type: selection.market_type
      })
    }
  }

  // Sort by exposure_rate DESC
  key_selections.sort((a, b) => {
    return parseFloat(b.exposure_rate) - parseFloat(a.exposure_rate)
  })

  return key_selections
}
