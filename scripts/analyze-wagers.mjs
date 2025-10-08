import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main } from '#libs-server'
import {
  load_wagers_from_files,
  build_selection_index,
  enrich_selections_from_db,
  build_unique_selections,
  calculate_wager_summary,
  calculate_props_summary,
  analyze_prop_near_miss_combinations,
  print_player_exposure_if_requested,
  print_summary_tables,
  print_round_robin_analysis_if_requested,
  print_lost_by_legs_if_requested,
  print_unique_props_table,
  print_exposures_by_game,
  print_prop_combination_tables,
  print_individual_wagers_if_not_hidden,
  print_fanatics_sets_if_requested,
  handle_markdown_outputs
} from '#libs-server/wager-analysis/index.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('analyze-wagers')
if (!argv.quiet) {
  debug.enable('analyze-wagers')
}

/**
 * Analyze wagers from FanDuel, DraftKings, and Fanatics sources.
 * Loads wager data, enriches with database results, and generates various
 * analysis reports including summaries, exposures, and individual wager details.
 *
 * @param {object} params
 * @param {string} [params.fanduel_filename] - FanDuel wager data filename
 * @param {string} [params.draftkings_filename] - DraftKings wager data filename
 * @param {string} [params.fanatics_filename] - Fanatics wager data filename
 * @param {number} [params.week] - Filter wagers by specific week
 * @param {boolean} [params.show_potential_gain] - Show potential gain columns
 * @param {boolean} [params.show_counts] - Show count columns in tables
 * @param {boolean} [params.show_bet_receipts] - Show bet receipt information
 * @param {number} [params.wagers_limit] - Limit number of wagers displayed
 * @param {boolean} [params.hide_wagers] - Hide individual wager tables
 * @param {number} [params.wagers_lost_leg_limit] - Filter by lost leg count
 * @param {Array} [params.include_selections] - Include only these selections
 * @param {Array} [params.exclude_selections] - Exclude these selections
 * @param {string} [params.sort_by] - Sort wagers by field ('odds', etc.)
 * @param {boolean} [params.show_wager_roi] - Show ROI columns
 * @param {boolean} [params.show_only_open_round_robins] - Show only open round robins
 * @param {boolean} [params.show_round_robins] - Show round robin analysis
 * @param {boolean} [params.show_fanatics_sets] - Show Fanatics sets analysis
 * @param {boolean} [params.show_player_exposure] - Show player exposure table
 * @param {boolean} [params.output_exposures] - Output exposures as markdown
 * @param {boolean} [params.output_template] - Output review template as markdown
 * @param {boolean} [params.output_search_wagers] - Output search wagers as markdown
 * @param {boolean} [params.output_near_misses] - Output near misses as markdown
 * @param {boolean} [params.output_key_selections] - Output key selections as markdown
 * @param {number} [params.year] - Year for template output
 */
const analyze_wagers = async ({
  fanduel_filename,
  draftkings_filename,
  fanatics_filename,
  week,
  show_potential_gain = false,
  show_counts = false,
  show_bet_receipts = false,
  wagers_limit = Infinity,
  hide_wagers = false,
  wagers_lost_leg_limit = 1,
  include_selections = [],
  exclude_selections = [],
  sort_by = 'odds',
  show_wager_roi = false,
  show_only_open_round_robins = false,
  show_round_robins = false,
  show_fanatics_sets = false,
  show_player_exposure = false,
  // Markdown output modes
  output_exposures = false,
  output_template = false,
  output_search_wagers = false,
  output_near_misses = false,
  output_key_selections = false,
  year = null
} = {}) => {
  if (!fanduel_filename && !draftkings_filename && !fanatics_filename) {
    throw new Error(
      'At least one filename (FanDuel, DraftKings or Fanatics) is required'
    )
  }

  log({
    fanduel_filename,
    draftkings_filename,
    fanatics_filename,
    week,
    show_potential_gain,
    show_counts,
    show_bet_receipts,
    wagers_limit,
    wagers_lost_leg_limit,
    include_selections,
    exclude_selections,
    sort_by
  })

  const { wagers, fanduel_round_robin_wagers } = await load_wagers_from_files({
    fanduel_filename,
    draftkings_filename,
    fanatics_filename,
    show_only_open_round_robins
  })

  // After both file reads, check if we have any wagers
  if (wagers.length === 0) {
    throw new Error(
      'No wagers found. Please check the filenames and try again.'
    )
  }

  const filtered = wagers.filter((wager) => {
    if (week) {
      return wager.week === week
    }
    return true
  })

  const wager_summary = calculate_wager_summary({ wagers: filtered })
  wager_summary.current_roi = `${(
    (wager_summary.total_won / wager_summary.total_risk - 1) *
    100
  ).toFixed(2)}%`
  wager_summary.total_risk = Number(wager_summary.total_risk.toFixed(2))
  wager_summary.open_potential_win = Number(
    wager_summary.open_potential_win.toFixed(2)
  )
  wager_summary.max_potential_win = Number(
    wager_summary.max_potential_win.toFixed(2)
  )

  const { selections_index } = build_selection_index({
    wagers: filtered
  })

  const { matching_stats } = await enrich_selections_from_db({
    selections_index,
    filtered_wagers: filtered
  })

  // Log matching statistics (unless quiet mode)
  if (!argv.quiet) {
    log('\nDatabase Matching Statistics:')
    log(`Total selections: ${matching_stats.total_selections}`)
    log(
      `Found in database: ${matching_stats.found_in_db} (${((matching_stats.found_in_db / matching_stats.total_selections) * 100).toFixed(1)}%)`
    )
    log(
      `With results: ${matching_stats.with_results} (${((matching_stats.with_results / matching_stats.total_selections) * 100).toFixed(1)}%)`
    )
    log(`Pending settlement: ${matching_stats.pending}`)
    log(`Not found: ${matching_stats.not_found}`)
  }

  const unique_selections = build_unique_selections({
    selections_index,
    filtered_wagers: filtered,
    total_risk: wager_summary.total_risk
  })

  const props_summary = calculate_props_summary(unique_selections)

  const lost_props = unique_selections.filter((prop) => prop.is_lost)
  const { one_prop, two_props, three_props } =
    analyze_prop_near_miss_combinations(lost_props, filtered, wager_summary)

  // Handle markdown output modes - these exit early BEFORE any console printing
  const handled_output = handle_markdown_outputs({
    output_exposures,
    output_template,
    output_near_misses,
    output_search_wagers,
    output_key_selections,
    unique_selections,
    filtered_wagers: filtered,
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
  })
  if (handled_output) return

  // Print all analysis tables and reports
  print_player_exposure_if_requested({
    unique_selections,
    filtered_wagers: filtered,
    wager_summary,
    show_player_exposure
  })

  print_summary_tables({
    wager_summary,
    props_summary,
    show_counts,
    show_potential_gain
  })

  print_round_robin_analysis_if_requested({
    fanduel_round_robin_wagers,
    show_round_robins
  })

  print_lost_by_legs_if_requested({
    wager_summary,
    show_counts
  })

  print_unique_props_table({
    unique_selections,
    show_counts,
    show_potential_gain
  })

  await print_exposures_by_game({
    wagers,
    unique_selections,
    show_counts,
    show_potential_gain
  })

  print_prop_combination_tables({
    one_prop,
    two_props,
    three_props
  })

  print_individual_wagers_if_not_hidden({
    filtered_wagers: filtered,
    wager_summary,
    hide_wagers,
    wagers_lost_leg_limit,
    exclude_selections,
    include_selections,
    sort_by,
    wagers_limit,
    show_wager_roi,
    show_potential_gain,
    show_bet_receipts
  })

  print_fanatics_sets_if_requested({
    wagers,
    show_fanatics_sets
  })
}

const main = async () => {
  let error
  try {
    await analyze_wagers({
      fanduel_filename: argv.fanduel,
      draftkings_filename: argv.draftkings,
      fanatics_filename: argv.fanatics,
      week: argv.week,
      show_potential_gain: argv.show_potential_gain,
      show_counts: argv.show_counts,
      show_bet_receipts: argv.show_bet_receipts,
      wagers_limit: argv.wagers_limit,
      wagers_lost_leg_limit: argv.wagers_lost_leg_limit,
      include_selections: Array.isArray(argv.include)
        ? argv.include
        : argv.include
          ? [argv.include]
          : [],
      exclude_selections: Array.isArray(argv.exclude)
        ? argv.exclude
        : argv.exclude
          ? [argv.exclude]
          : [],
      hide_wagers: argv.hide_wagers,
      sort_by: argv.sort_by || 'odds',
      show_wager_roi: argv.show_wager_roi,
      show_only_open_round_robins: argv.show_only_open_round_robins,
      show_round_robins: argv.show_round_robins,
      show_fanatics_sets: argv.show_fanatics_sets,
      show_player_exposure: argv.show_player_exposure,
      // Markdown output modes
      output_exposures: argv.exposures,
      output_template: argv.template,
      output_search_wagers: argv.searchWagers || argv.search_wagers,
      output_near_misses: argv.nearMisses || argv.near_misses,
      output_key_selections: argv.keySelections || argv.key_selections,
      year: argv.year
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default analyze_wagers
