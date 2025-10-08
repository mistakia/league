import { Table } from 'console-table-printer'
import {
  format_metric_result,
  format_threshold_distance
} from './wager-calculations.mjs'

// Create player exposure summary table
export const create_player_exposure_table = (
  player_summary,
  filtered_wagers_count,
  total_risk
) => {
  const player_summary_table = new Table({ title: 'Player Exposure Summary' })
  Object.entries(player_summary)
    .map(([player_name, stats]) => ({
      player_name,
      props_count: stats.props_count,
      exposure_count: stats.exposure_count,
      exposure_rate: `${((stats.exposure_count / filtered_wagers_count) * 100).toFixed(2)}%`,
      open_wagers: stats.open_wagers,
      open_potential_roi: `${((stats.open_potential_payout / total_risk) * 100).toFixed(0)}%`,
      max_potential_roi: `${((stats.max_potential_payout / total_risk) * 100).toFixed(0)}%`
    }))
    .sort((a, b) => b.exposure_count - a.exposure_count)
    .forEach((player) => player_summary_table.addRow(player))

  return player_summary_table
}

// Create wager summary table
export const create_wager_summary_table = (
  wager_summary,
  props_summary,
  show_counts = false,
  show_potential_gain = false
) => {
  const wager_summary_table = new Table({ title: 'Execution Summary' })

  const add_row = (label, value) => {
    if (typeof value === 'number') {
      if (label.includes('Potential Win')) {
        value = value.toLocaleString('en-US', { maximumFractionDigits: 2 })
      } else if (label === 'Market Implied Hits') {
        value = value.toFixed(2)
      }
    }
    wager_summary_table.addRow({ Metric: label, Value: value })
  }

  add_row('ROI', wager_summary.current_roi)
  add_row(
    'Open Potential ROI',
    `${((wager_summary.open_potential_win / wager_summary.total_risk - 1) * 100).toFixed(0)}%`
  )
  add_row(
    'Max Potential ROI',
    `${((wager_summary.max_potential_win / wager_summary.total_risk - 1) * 100).toFixed(0)}%`
  )

  // Add rows for props_summary
  for (const [key, value] of Object.entries(props_summary)) {
    let display_key = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())

    // Handle specific field name changes
    if (key === 'total_selections') {
      display_key = 'Total Selections'
    } else if (key === 'market_implied_hits') {
      display_key = 'Market Implied Hits'
    }

    add_row(display_key, value)
  }

  if (show_counts) {
    add_row('Wagers', wager_summary.wagers)
    add_row('Total Won', wager_summary.total_won.toFixed(2))
    add_row('Wagers Open', wager_summary.wagers_open)
    add_row('Total Risk', wager_summary.total_risk)
  }

  if (show_potential_gain) {
    add_row('Open Potential Win', wager_summary.open_potential_win)
    add_row('Max Potential Win', wager_summary.max_potential_win)
  }

  return wager_summary_table
}

// Create lost by legs summary table
export const create_lost_by_legs_table = (wager_summary) => {
  const lost_by_legs_summary_table = new Table({
    title: 'Wagers Lost By # Selections'
  })
  lost_by_legs_summary_table.addRow({
    1: wager_summary.lost_by_one_leg,
    2: wager_summary.lost_by_two_legs,
    3: wager_summary.lost_by_three_legs,
    '4+': wager_summary.lost_by_four_or_more_legs
  })
  return lost_by_legs_summary_table
}

// Create unique props table
export const create_unique_props_table = (
  unique_selections,
  show_counts = false,
  show_potential_gain = false
) => {
  const unique_props_table = new Table()
  const props_with_exposure = unique_selections.map((prop) => {
    const result = {
      name: prop.name,
      odds: prop.parsed_odds,
      result: prop.result,
      exposure_rate: prop.exposure_rate
    }

    if (show_counts) {
      result.exposure_count = prop.exposure_count
      result.open_wagers = prop.open_wagers
    }

    if (show_potential_gain) {
      result.open_potential_payout = prop.open_potential_payout.toFixed(2)
      result.open_potential_roi = prop.open_potential_roi
    }
    result.max_potential_roi = prop.max_potential_roi

    if (show_potential_gain) {
      result.max_potential_payout = prop.max_potential_payout.toFixed(2)
    }

    // Move threshold, actual, and diff columns to the end
    result.threshold =
      prop.selection_metric_line !== null &&
      prop.selection_metric_line !== undefined
        ? Number(prop.selection_metric_line).toFixed(1)
        : '-'
    result.actual = format_metric_result(prop.metric_result_value)
    result.diff = format_threshold_distance(
      prop.distance_from_threshold,
      prop.selection_type
    )

    return result
  })

  props_with_exposure.forEach((prop) => unique_props_table.addRow(prop))
  return unique_props_table
}

// Create event-specific exposure table
export const create_event_exposure_table = (
  event_title,
  props,
  show_counts = false,
  show_potential_gain = false
) => {
  const event_table = new Table({
    title: event_title || 'Unknown Game'
  })
  props
    .sort((a, b) => b.exposure_count - a.exposure_count)
    .forEach((prop) => {
      const row = {
        name: prop.name,
        odds: prop.parsed_odds,
        result: prop.result,
        exposure_rate: prop.exposure_rate,
        max_potential_roi: prop.max_potential_roi,
        open_potential_roi: prop.open_potential_roi
      }

      if (show_counts) {
        row.open_wagers = prop.open_wagers
      }

      if (show_potential_gain) {
        row.open_potential_payout = prop.open_potential_payout.toFixed(2)
        row.max_potential_payout = prop.max_potential_payout.toFixed(2)
      }

      // Move threshold, actual, and diff columns to the end
      row.threshold =
        prop.selection_metric_line !== null &&
        prop.selection_metric_line !== undefined
          ? Number(prop.selection_metric_line).toFixed(1)
          : '-'
      row.actual = format_metric_result(prop.metric_result_value)
      row.diff = format_threshold_distance(
        prop.distance_from_threshold,
        prop.selection_type
      )

      event_table.addRow(row)
    })
  return event_table
}

// Create prop combination table (one/two/three legs away)
export const create_prop_combination_table = (props, title) => {
  if (props.length === 0) {
    return null
  }
  const table = new Table({ title })
  for (const prop of props.sort(
    (a, b) => b.potential_gain - a.potential_gain
  )) {
    const row = {
      name: prop.name,
      potential_roi_added: `${prop.potential_roi_added.toFixed(2)}%`,
      potential_gain: prop.potential_gain.toFixed(2),
      potential_wins: prop.potential_wins
    }

    // Add threshold/actual/diff columns for single prop combinations (one leg away) at the end
    if (prop.threshold !== undefined) {
      row.threshold =
        prop.threshold !== null && prop.threshold !== undefined
          ? Number(prop.threshold).toFixed(1)
          : '-'
      row.actual = format_metric_result(prop.actual)
      row.diff = format_threshold_distance(prop.diff, prop.selection_type)
    }

    table.addRow(row)
  }
  return table
}

// Create individual wager table
export const create_wager_table = (wager, options = {}) => {
  const {
    show_wager_roi = false,
    show_potential_gain = false,
    show_bet_receipts = false,
    total_risk = 0
  } = options

  const potential_roi_gain = (wager.potential_win / total_risk) * 100
  const num_of_legs = wager.selections.length
  let wager_table_title = `[${num_of_legs} leg parlay] American odds: ${
    wager.parsed_odds > 0 ? '+' : ''
  }${Number(wager.parsed_odds).toFixed(0)}`

  if (show_wager_roi) {
    wager_table_title += ` / ${potential_roi_gain.toFixed(2)}% roi`
  }

  if (show_potential_gain) {
    wager_table_title += ` ($${wager.potential_win.toFixed(2)})`
  }

  if (show_bet_receipts && wager.bet_receipt_id) {
    wager_table_title += ` / Bet Receipt: ${wager.bet_receipt_id}`
  }

  const wager_table = new Table({ title: wager_table_title })
  for (const selection of wager.selections) {
    wager_table.addRow({
      selection: selection.name,
      odds: selection.parsed_odds,
      result: selection.is_won ? 'WON' : selection.is_lost ? 'LOST' : 'OPEN',
      threshold:
        selection.selection_metric_line !== null &&
        selection.selection_metric_line !== undefined
          ? Number(selection.selection_metric_line).toFixed(1)
          : '-',
      actual: format_metric_result(selection.metric_result_value),
      diff: format_threshold_distance(
        selection.distance_from_threshold,
        selection.selection_type
      )
    })
  }
  return wager_table
}
