import {
  format_exposures_markdown,
  format_review_template,
  format_key_selections_markdown
} from './wager-exposure-markdown-formatters.mjs'
import {
  format_wager_search_markdown,
  format_near_misses_markdown
} from './wager-search-markdown-formatters.mjs'
import {
  filter_wagers_by_lost_legs,
  filter_wagers_excluding_selections,
  filter_wagers_including_selections,
  sort_wagers
} from './wager-filters.mjs'
import { calculate_key_selections } from './key-selections-analysis.mjs'

/**
 * When markdown output modes are requested, render and exit.
 *
 * @returns {boolean} true if an output mode was handled and the process exited
 */
export const handle_markdown_outputs = ({
  output_exposures,
  output_template,
  output_near_misses,
  output_search_wagers,
  output_key_selections,
  unique_selections,
  filtered_wagers,
  wager_summary,
  props_summary,
  one_prop,
  two_props,
  three_props,
  wagers_lost_leg_limit,
  exclude_selections,
  include_selections,
  sort_by,
  wagers_limit,
  show_wager_roi,
  show_potential_gain,
  show_bet_receipts,
  week,
  year
}) => {
  if (output_exposures) {
    const markdown = format_exposures_markdown(
      unique_selections,
      filtered_wagers.length,
      wager_summary.total_risk
    )
    console.log(markdown)
    process.exit(0)
    return true
  }

  if (output_template) {
    const markdown = format_review_template({
      wager_summary,
      props_summary,
      unique_selections,
      filtered_wagers,
      wagers_lost_leg_limit,
      wagers_limit,
      sort_by,
      week,
      year
    })
    console.log(markdown)
    process.exit(0)
    return true
  }

  if (output_near_misses) {
    const markdown = format_near_misses_markdown({
      one_prop,
      two_props,
      three_props
    })
    console.log(markdown)
    process.exit(0)
    return true
  }

  if (output_search_wagers) {
    let display_wagers = filter_wagers_by_lost_legs(
      filtered_wagers,
      wagers_lost_leg_limit
    )
    display_wagers = filter_wagers_excluding_selections(
      display_wagers,
      exclude_selections
    )
    display_wagers = filter_wagers_including_selections(
      display_wagers,
      include_selections
    )
    const sorted_wagers = sort_wagers(display_wagers, sort_by)
    const limited_wagers = sorted_wagers.slice(0, wagers_limit)

    const markdown = format_wager_search_markdown(limited_wagers, {
      show_wager_roi,
      show_potential_gain,
      show_bet_receipts,
      total_risk: wager_summary.total_risk
    })
    console.log(markdown)
    process.exit(0)
    return true
  }

  if (output_key_selections) {
    const key_selections = calculate_key_selections({
      unique_selections,
      filtered_wagers,
      total_wagers: filtered_wagers.length
    })
    const markdown = format_key_selections_markdown(key_selections)
    console.log(markdown)
    process.exit(0)
    return true
  }

  return false
}
