import {
  format_metric_result,
  format_threshold_distance
} from './wager-calculations.mjs'

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

// Format review document template as markdown
export const format_review_template = ({
  wager_summary,
  props_summary,
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

  // Placeholder sections
  lines.push('## Missed Selection Analysis\n')
  lines.push('<!-- Analysis of missed selections will be appended here -->\n')

  lines.push('## Notable Wagers\n')
  lines.push('<!-- Notable wagers will be appended here -->\n')

  lines.push('## Key Learnings\n')
  lines.push('<!-- Key learnings from the week -->\n')

  return lines.join('\n')
}
