import {
  format_metric_result,
  format_threshold_distance
} from './wager-calculations.mjs'

// Format wager search results as markdown
export const format_wager_search_markdown = (wagers, options = {}) => {
  const {
    show_wager_roi = false,
    show_potential_gain = false,
    show_bet_receipts = false,
    total_risk = 0
  } = options

  const lines = []
  lines.push('## Wager Search Results\n')

  for (const wager of wagers) {
    const potential_roi_gain = (wager.potential_win / total_risk) * 100
    const num_of_legs = wager.selections.length

    let title = `### [${num_of_legs} leg parlay] American odds: ${wager.parsed_odds > 0 ? '+' : ''}${Number(wager.parsed_odds).toFixed(0)}`

    if (show_wager_roi) {
      title += ` / ${potential_roi_gain.toFixed(2)}% roi`
    }

    if (show_potential_gain) {
      title += ` ($${wager.potential_win.toFixed(2)})`
    }

    if (show_bet_receipts && wager.bet_receipt_id) {
      title += ` / Bet Receipt: ${wager.bet_receipt_id}`
    }

    lines.push(`${title}\n`)

    // Wager table
    lines.push('| Selection | Odds | Result | Threshold | Actual | Diff |')
    lines.push('|-----------|------|--------|-----------|--------|------|')

    for (const selection of wager.selections) {
      const threshold =
        selection.selection_metric_line !== null &&
        selection.selection_metric_line !== undefined
          ? Number(selection.selection_metric_line).toFixed(1)
          : '-'
      const actual = format_metric_result(selection.metric_result_value)
      const diff = format_threshold_distance(
        selection.distance_from_threshold,
        selection.selection_type
      )
      const result = selection.is_won
        ? 'WON'
        : selection.is_lost
          ? 'LOST'
          : 'OPEN'

      lines.push(
        `| ${selection.name} | ${selection.parsed_odds} | ${result} | ${threshold} | ${actual} | ${diff} |`
      )
    }

    lines.push('') // Empty line between wagers
  }

  return lines.join('\n')
}

// Format near-miss combinations as markdown
export const format_near_misses_markdown = ({
  one_prop,
  two_props,
  three_props
}) => {
  const lines = []
  lines.push('## Near-Miss Combinations\n')

  // One Leg Away
  if (one_prop && one_prop.length > 0) {
    lines.push('### One Leg Away\n')
    lines.push(
      '| Name | Potential ROI Added | Potential Gain | Potential Wins | Threshold | Actual | Diff |'
    )
    lines.push(
      '|------|---------------------|----------------|----------------|-----------|--------|------|'
    )

    for (const prop of one_prop.sort(
      (a, b) => b.potential_gain - a.potential_gain
    )) {
      const threshold =
        prop.threshold !== null && prop.threshold !== undefined
          ? Number(prop.threshold).toFixed(1)
          : '-'
      const actual = format_metric_result(prop.actual)
      const diff = format_threshold_distance(prop.diff, prop.selection_type)

      lines.push(
        `| ${prop.name} | ${prop.potential_roi_added.toFixed(2)}% | ${prop.potential_gain.toFixed(2)} | ${prop.potential_wins} | ${threshold} | ${actual} | ${diff} |`
      )
    }
    lines.push('')
  }

  // Two Legs Away
  if (two_props && two_props.length > 0) {
    lines.push('### Two Legs Away\n')
    lines.push(
      '| Name | Potential ROI Added | Potential Gain | Potential Wins |'
    )
    lines.push(
      '|------|---------------------|----------------|----------------|'
    )

    for (const prop of two_props.sort(
      (a, b) => b.potential_gain - a.potential_gain
    )) {
      lines.push(
        `| ${prop.name} | ${prop.potential_roi_added.toFixed(2)}% | ${prop.potential_gain.toFixed(2)} | ${prop.potential_wins} |`
      )
    }
    lines.push('')
  }

  // Three Legs Away
  if (three_props && three_props.length > 0) {
    lines.push('### Three Legs Away\n')
    lines.push(
      '| Name | Potential ROI Added | Potential Gain | Potential Wins |'
    )
    lines.push(
      '|------|---------------------|----------------|----------------|'
    )

    for (const prop of three_props.sort(
      (a, b) => b.potential_gain - a.potential_gain
    )) {
      lines.push(
        `| ${prop.name} | ${prop.potential_roi_added.toFixed(2)}% | ${prop.potential_gain.toFixed(2)} | ${prop.potential_wins} |`
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}
