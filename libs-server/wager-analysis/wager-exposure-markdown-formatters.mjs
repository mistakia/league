import {
  format_metric_result,
  format_threshold_distance
} from './wager-calculations.mjs'
import { calculate_key_selections } from './key-selections-analysis.mjs'
import { filter_wagers_by_lost_legs, sort_wagers } from './wager-filters.mjs'
import { format_wager_search_markdown } from './wager-search-markdown-formatters.mjs'

// Format exposures table as markdown
export const format_exposures_markdown = (
  unique_selections,
  filtered_wagers_count,
  total_risk
) => {
  const lines = []
  lines.push('## Exposures\n')
  lines.push(
    '| Name | Odds | Result | Exposure | Potential ROI | Threshold | Actual | Diff |'
  )
  lines.push(
    '|------|------|--------|----------|---------------|-----------|--------|------|'
  )

  const sorted_selections = unique_selections
    .map((prop) => ({
      ...prop,
      exposure_rate_num: parseFloat(prop.exposure_rate.replace('%', ''))
    }))
    .sort((a, b) => b.exposure_rate_num - a.exposure_rate_num)

  for (const prop of sorted_selections) {
    const threshold =
      prop.selection_metric_line !== null &&
      prop.selection_metric_line !== undefined
        ? Number(prop.selection_metric_line).toFixed(1)
        : '-'
    const actual = format_metric_result(prop.metric_result_value)
    const diff = format_threshold_distance(
      prop.distance_from_threshold,
      prop.selection_type
    )

    lines.push(
      `| ${prop.name} | ${prop.parsed_odds} | ${prop.result} | ${prop.exposure_rate} | ${prop.max_potential_roi} | ${threshold} | ${actual} | ${diff} |`
    )
  }

  return lines.join('\n')
}

// Format key selections table as markdown
export const format_key_selections_markdown = (key_selections) => {
  const lines = []
  lines.push('## Key Selections\n')
  lines.push(
    '| Selection | Odds | Result | Exposure | Threshold | Actual | Diff | 1L | 2L | 3L | Notes |'
  )
  lines.push(
    '|-----------|------|--------|----------|-----------|--------|------|----|----|----|----|'
  )

  for (const selection of key_selections) {
    const threshold =
      selection.threshold !== null && selection.threshold !== undefined
        ? Number(selection.threshold).toFixed(1)
        : '-'
    const actual = format_metric_result(selection.actual)
    const diff = format_threshold_distance(
      selection.diff,
      selection.selection_type
    )

    lines.push(
      `| ${selection.name} | ${selection.odds > 0 ? '+' : ''}${selection.odds} | ${selection.result} | ${selection.exposure_rate} | ${threshold} | ${actual} | ${diff} | ${selection.lost_by_1_count} | ${selection.lost_by_2_count} | ${selection.lost_by_3_count} | [TBD] |`
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
  wagers_lost_leg_limit = 2,
  wagers_limit = 10,
  sort_by = 'payout',
  week,
  year
}) => {
  const lines = []

  // Header with frontmatter
  lines.push('---')
  lines.push(`title: Week ${week} Betting Gameplan Review`)
  lines.push('type: text')
  lines.push(`created_at: '${new Date().toISOString()}'`)
  lines.push('tags:')
  lines.push('  - user:tag/finance-management.md')
  lines.push('---\n')

  lines.push(`# Week ${week} Betting Gameplan Review (${year})\n`)

  // Performance Summary
  lines.push('## Performance Summary\n')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| ROI | ${wager_summary.current_roi} |`)
  lines.push(
    `| Max Potential ROI | ${((wager_summary.max_potential_win / wager_summary.total_risk - 1) * 100).toFixed(0)}% |`
  )
  lines.push(`| Total Selections | ${props_summary.total_selections} |`)
  lines.push(
    `| Market Implied Hits | ${props_summary.market_implied_hits.toFixed(2)} |`
  )
  lines.push(`| Actual Hits | ${props_summary.actual_hits} |`)
  lines.push(`| Wagers Won | ${wager_summary.wagers_won} |\n`)

  // Wagers Lost By # Selections
  lines.push('## Wagers Lost By # Selections\n')
  lines.push('| 1 | 2 | 3 | 4+ |')
  lines.push('|---|---|---|----|')
  lines.push(
    `| ${wager_summary.lost_by_one_leg} | ${wager_summary.lost_by_two_legs} | ${wager_summary.lost_by_three_legs} | ${wager_summary.lost_by_four_or_more_legs} |\n`
  )

  // Key Selections - generate the actual table
  const key_selections = calculate_key_selections({
    unique_selections,
    filtered_wagers,
    total_wagers: filtered_wagers.length
  })

  const key_selections_markdown = format_key_selections_markdown(key_selections)
  lines.push(key_selections_markdown)
  lines.push('\n')

  // Key Learnings placeholder
  lines.push('## Key Learnings\n')
  lines.push('<!-- Key learnings from the week -->\n')

  // Notable Wagers - generate the actual wagers
  let notable_wagers = filter_wagers_by_lost_legs(
    filtered_wagers,
    wagers_lost_leg_limit
  )
  notable_wagers = sort_wagers(notable_wagers, sort_by)
  notable_wagers = notable_wagers.slice(0, wagers_limit)

  if (notable_wagers.length > 0) {
    const notable_wagers_markdown = format_wager_search_markdown(
      notable_wagers,
      {
        show_wager_roi: false,
        show_potential_gain: true,
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

  // Missed Selection Analysis placeholder
  lines.push('## Missed Selection Analysis\n')
  lines.push('<!-- Analysis of missed selections will be appended here -->\n')

  return lines.join('\n')
}
