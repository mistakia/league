import {
  format_metric_result,
  format_threshold_distance
} from './wager-calculations.mjs'
import { calculate_key_selections } from './key-selections-analysis.mjs'
import { filter_wagers_by_lost_legs } from './wager-filters.mjs'
import { format_wager_search_markdown } from './wager-search-markdown-formatters.mjs'

// Constants
const LONGSHOT_ODDS_THRESHOLD = 180

// Helper functions for table formatting
const format_table_header = (columns) => {
  return `| ${columns.join(' | ')} |`
}

const format_table_separator = (columns) => {
  return `|${columns.map(() => '---').join('|')}|`
}

const format_table_row = (values) => {
  return `| ${values.join(' | ')} |`
}

const format_threshold_value = (threshold) => {
  return threshold !== null && threshold !== undefined
    ? Number(threshold).toFixed(1)
    : '-'
}

// Helper functions for review template sections
const format_header = (week, year) => {
  const lines = []
  lines.push('---')
  lines.push(`title: Week ${week} Betting Gameplan Review`)
  lines.push('type: text')
  lines.push(`created_at: '${new Date().toISOString()}'`)
  lines.push('---\n')
  lines.push(`# Week ${week} Betting Gameplan Review (${year})\n`)
  return lines.join('\n')
}

const format_performance_summary = (wager_summary, props_summary) => {
  const lines = []
  lines.push('## Performance Summary\n')
  lines.push(format_table_header(['Metric', 'Value']))
  lines.push(format_table_separator(['Metric', 'Value']))
  lines.push(format_table_row(['ROI', wager_summary.current_roi]))
  lines.push(
    format_table_row([
      'Max Potential ROI',
      `${((wager_summary.max_potential_win / wager_summary.total_risk - 1) * 100).toFixed(0)}%`
    ])
  )
  lines.push(
    format_table_row(['Total Selections', props_summary.total_selections])
  )
  lines.push(
    format_table_row([
      'Market Implied Hits',
      props_summary.market_implied_hits.toFixed(2)
    ])
  )
  lines.push(format_table_row(['Actual Hits', props_summary.actual_hits]))
  lines.push(format_table_row(['Wagers Won', wager_summary.wagers_won]))
  lines.push(
    format_table_row([
      'Max Wager Odds',
      wager_summary.max_wager_odds > 0
        ? `+${wager_summary.max_wager_odds}`
        : wager_summary.max_wager_odds
    ])
  )
  lines.push(
    format_table_row([
      'Avg Wager Odds',
      wager_summary.avg_wager_odds > 0
        ? `+${wager_summary.avg_wager_odds}`
        : wager_summary.avg_wager_odds
    ])
  )
  lines.push('')
  return lines.join('\n')
}

const format_wagers_lost_by_selections = (wager_summary) => {
  const lines = []
  lines.push('## Wagers Lost By # Selections\n')
  lines.push(format_table_header(['1', '2', '3', '4+']))
  lines.push(format_table_separator(['1', '2', '3', '4+']))
  lines.push(
    format_table_row([
      wager_summary.lost_by_one_leg,
      wager_summary.lost_by_two_legs,
      wager_summary.lost_by_three_legs,
      wager_summary.lost_by_four_or_more_legs
    ])
  )
  lines.push('')
  return lines.join('\n')
}

const format_wagers_by_odds_range = (wager_summary) => {
  const lines = []
  lines.push('## Wagers By Odds Range\n')
  lines.push(format_table_header(['Odds Range', 'Count']))
  lines.push(format_table_separator(['Odds Range', 'Count']))

  const ranges = [
    ['< +100', wager_summary.wagers_by_odds_range.under_100],
    ['+100 to +400', wager_summary.wagers_by_odds_range.range_100_400],
    ['+400 to +1000', wager_summary.wagers_by_odds_range.range_400_1000],
    ['+1000 to +10000', wager_summary.wagers_by_odds_range.range_1000_10000],
    ['+10000 to +50000', wager_summary.wagers_by_odds_range.range_10000_50000],
    ['+50000 to +100000', wager_summary.wagers_by_odds_range.range_50000_100000],
    ['+100000 to +150000', wager_summary.wagers_by_odds_range.range_100000_150000],
    ['+150000 to +250000', wager_summary.wagers_by_odds_range.range_150000_250000],
    ['+250000 to +500000', wager_summary.wagers_by_odds_range.range_250000_500000],
    ['+500000 to +1000000', wager_summary.wagers_by_odds_range.range_500000_1000000],
    ['> +1000000', wager_summary.wagers_by_odds_range.over_1000000]
  ]

  for (const [range, count] of ranges) {
    lines.push(format_table_row([range, count]))
  }

  lines.push('')
  return lines.join('\n')
}

const format_classification_of_misses = () => {
  const lines = []
  lines.push('## Classification of Misses\n')
  lines.push('<!-- Classification of misses from the week -->\n')
  return lines.join('\n')
}

const format_notable_longshots = (unique_selections) => {
  const longshot_selections = unique_selections.filter(
    (prop) => prop.parsed_odds >= LONGSHOT_ODDS_THRESHOLD && prop.is_won
  )

  if (longshot_selections.length === 0) {
    return ''
  }

  const lines = []
  lines.push('## Notable Longshots\n')
  lines.push(
    format_table_header([
      'Selection',
      'Odds',
      'Exposure',
      'Threshold',
      'Actual',
      'Diff'
    ])
  )
  lines.push(
    format_table_separator([
      'Selection',
      'Odds',
      'Exposure',
      'Threshold',
      'Actual',
      'Diff'
    ])
  )

  const sorted_longshots = longshot_selections.sort(
    (a, b) => b.parsed_odds - a.parsed_odds
  )

  for (const prop of sorted_longshots) {
    const threshold = format_threshold_value(prop.selection_metric_line)
    const actual = format_metric_result(prop.metric_result_value)
    const diff = format_threshold_distance(
      prop.distance_from_threshold,
      prop.selection_type
    )

    lines.push(
      format_table_row([
        prop.name,
        `+${prop.parsed_odds}`,
        prop.exposure_rate,
        threshold,
        actual,
        diff
      ])
    )
  }
  lines.push('')
  return lines.join('\n')
}

const format_near_miss_combinations = (one_prop, two_props, three_props) => {
  const lines = []

  // One Leg Away
  if (one_prop && one_prop.length > 0) {
    lines.push('### One Leg Away\n')
    lines.push(
      format_table_header([
        'Name',
        'Potential ROI Added',
        'Potential Wins',
        'Threshold',
        'Actual',
        'Diff'
      ])
    )
    lines.push(
      format_table_separator([
        'Name',
        'Potential ROI Added',
        'Potential Wins',
        'Threshold',
        'Actual',
        'Diff'
      ])
    )

    for (const prop of one_prop.sort(
      (a, b) => b.potential_gain - a.potential_gain
    )) {
      const threshold = format_threshold_value(prop.threshold)
      const actual = format_metric_result(prop.actual)
      const diff = format_threshold_distance(prop.diff, prop.selection_type)

      lines.push(
        format_table_row([
          prop.name,
          `${prop.potential_roi_added.toFixed(2)}%`,
          prop.potential_wins,
          threshold,
          actual,
          diff
        ])
      )
    }
    lines.push('')
  }

  // Two Legs Away
  if (two_props && two_props.length > 0) {
    lines.push('### Two Legs Away\n')
    lines.push(
      format_table_header(['Name', 'Potential ROI Added', 'Potential Wins'])
    )
    lines.push(
      format_table_separator(['Name', 'Potential ROI Added', 'Potential Wins'])
    )

    for (const prop of two_props.sort(
      (a, b) => b.potential_gain - a.potential_gain
    )) {
      lines.push(
        format_table_row([
          prop.name,
          `${prop.potential_roi_added.toFixed(2)}%`,
          prop.potential_wins
        ])
      )
    }
    lines.push('')
  }

  // Three Legs Away
  if (three_props && three_props.length > 0) {
    lines.push('### Three Legs Away\n')
    lines.push(
      format_table_header(['Name', 'Potential ROI Added', 'Potential Wins'])
    )
    lines.push(
      format_table_separator(['Name', 'Potential ROI Added', 'Potential Wins'])
    )

    for (const prop of three_props.sort(
      (a, b) => b.potential_gain - a.potential_gain
    )) {
      lines.push(
        format_table_row([
          prop.name,
          `${prop.potential_roi_added.toFixed(2)}%`,
          prop.potential_wins
        ])
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

const has_new_key_selection = (wager, key_selections, used_key_selections) => {
  for (const selection of wager.selections) {
    const selection_key = `${selection.event_id}/${selection.selection_id}/${selection.market_type || 'unknown'}`

    const is_key_selection = key_selections.some((ks) => {
      const ks_key = `${ks.event_id}/${ks.selection_id}/${ks.market_type || 'unknown'}`
      return ks_key === selection_key
    })

    if (is_key_selection && !used_key_selections.has(selection_key)) {
      used_key_selections.add(selection_key)
      return true
    }
  }
  return false
}

const select_notable_wagers = (wagers, key_selections, limit) => {
  const selected_wagers = []
  const used_key_selections = new Set()

  for (const wager of wagers) {
    if (has_new_key_selection(wager, key_selections, used_key_selections)) {
      selected_wagers.push(wager)
      if (selected_wagers.length >= limit) {
        break
      }
    }
  }

  return selected_wagers
}

const format_notable_wagers = (
  filtered_wagers,
  key_selections,
  wagers_lost_leg_limit,
  wagers_limit,
  wager_summary
) => {
  // Filter wagers by lost leg limit
  let notable_wagers = filter_wagers_by_lost_legs(
    filtered_wagers,
    wagers_lost_leg_limit
  )

  // Sort by legs lost ASC, then odds DESC
  notable_wagers = [...notable_wagers].sort((a, b) => {
    const a_lost_legs = a.selections.filter((s) => s.is_lost).length
    const b_lost_legs = b.selections.filter((s) => s.is_lost).length

    // First sort by legs lost ascending
    if (a_lost_legs !== b_lost_legs) {
      return a_lost_legs - b_lost_legs
    }

    // Then sort by odds descending
    return b.parsed_odds - a.parsed_odds
  })

  // Select one wager per key selection
  const selected_wagers = select_notable_wagers(
    notable_wagers,
    key_selections,
    wagers_limit
  )

  const lines = []
  lines.push('## Notable Wagers\n')

  if (selected_wagers.length > 0) {
    const notable_wagers_markdown = format_wager_search_markdown(
      selected_wagers,
      {
        show_wager_roi: false,
        show_potential_gain: false,
        show_bet_receipts: false,
        total_risk: wager_summary.total_risk
      }
    )
    // Replace the heading from "Wager Search Results" to nothing (already have "Notable Wagers")
    lines.push(notable_wagers_markdown.replace('## Wager Search Results\n', ''))
  } else {
    lines.push('No notable wagers found.\n')
  }
  lines.push('\n')

  return lines.join('\n')
}

const format_missed_selection_analysis = () => {
  const lines = []
  lines.push('## Missed Selection Analysis\n')
  lines.push('<!-- Analysis of missed selections will be appended here -->\n')
  return lines.join('\n')
}

const format_key_selections_table = (key_selections) => {
  const key_selections_markdown = format_key_selections_markdown(key_selections)
  return key_selections_markdown + '\n'
}

// Format exposures table as markdown
export const format_exposures_markdown = (
  unique_selections,
  filtered_wagers_count,
  total_risk
) => {
  const lines = []
  lines.push('## Exposures\n')
  lines.push(
    format_table_header([
      'Name',
      'Odds',
      'Result',
      'Exposure',
      'Potential ROI',
      'Threshold',
      'Actual',
      'Diff'
    ])
  )
  lines.push(
    format_table_separator([
      'Name',
      'Odds',
      'Result',
      'Exposure',
      'Potential ROI',
      'Threshold',
      'Actual',
      'Diff'
    ])
  )

  const sorted_selections = unique_selections
    .map((prop) => ({
      ...prop,
      exposure_rate_num: parseFloat(prop.exposure_rate.replace('%', ''))
    }))
    .sort((a, b) => b.exposure_rate_num - a.exposure_rate_num)

  for (const prop of sorted_selections) {
    const threshold = format_threshold_value(prop.selection_metric_line)
    const actual = format_metric_result(prop.metric_result_value)
    const diff = format_threshold_distance(
      prop.distance_from_threshold,
      prop.selection_type
    )

    lines.push(
      format_table_row([
        prop.name,
        prop.parsed_odds,
        prop.result,
        prop.exposure_rate,
        prop.max_potential_roi,
        threshold,
        actual,
        diff
      ])
    )
  }

  return lines.join('\n')
}

// Format key selections table as markdown
export const format_key_selections_markdown = (key_selections) => {
  const lines = []
  lines.push('## Key Selections\n')
  lines.push(
    format_table_header([
      'Selection',
      'Odds',
      'Result',
      'Notes',
      'Exposure',
      'Threshold',
      'Actual',
      'Diff',
      '1L',
      '2L',
      '3L'
    ])
  )
  lines.push(
    format_table_separator([
      'Selection',
      'Odds',
      'Result',
      'Notes',
      'Exposure',
      'Threshold',
      'Actual',
      'Diff',
      '1L',
      '2L',
      '3L'
    ])
  )

  for (const selection of key_selections) {
    const threshold = format_threshold_value(selection.threshold)
    const actual = format_metric_result(selection.actual)
    const diff = format_threshold_distance(
      selection.diff,
      selection.selection_type
    )

    lines.push(
      format_table_row([
        selection.name,
        `${selection.odds > 0 ? '+' : ''}${selection.odds}`,
        selection.result,
        '[TBD]',
        selection.exposure_rate,
        threshold,
        actual,
        diff,
        selection.lost_by_1_count,
        selection.lost_by_2_count,
        selection.lost_by_3_count
      ])
    )
  }

  return lines.join('\n')
}

// Format review document template as markdown with all static content
export const format_review_template = ({
  wager_summary,
  props_summary,
  unique_selections,
  filtered_wagers,
  one_prop,
  two_props,
  three_props,
  wagers_lost_leg_limit = 2,
  wagers_limit = 10,
  sort_by = 'payout',
  week,
  year
}) => {
  const lines = []

  // Header with frontmatter
  lines.push(format_header(week, year))

  // Performance Summary
  lines.push(format_performance_summary(wager_summary, props_summary))

  // Wagers Lost By # Selections
  lines.push(format_wagers_lost_by_selections(wager_summary))

  // Wagers By Odds Range
  lines.push(format_wagers_by_odds_range(wager_summary))

  // Classification of Misses placeholder
  lines.push(format_classification_of_misses())

  // Notable Longshots
  lines.push(format_notable_longshots(unique_selections))

  lines.push('---\n')

  // Calculate key selections early (needed for notable wagers section)
  const key_selections = calculate_key_selections({
    unique_selections,
    filtered_wagers,
    total_wagers: filtered_wagers.length
  })

  // Near-Miss Combinations
  lines.push(format_near_miss_combinations(one_prop, two_props, three_props))

  // Notable Wagers
  lines.push(
    format_notable_wagers(
      filtered_wagers,
      key_selections,
      wagers_lost_leg_limit,
      wagers_limit,
      wager_summary
    )
  )

  // Missed Selection Analysis placeholder
  lines.push(format_missed_selection_analysis())

  // Key Selections - place table at end
  lines.push(format_key_selections_table(key_selections))

  return lines.join('\n')
}
