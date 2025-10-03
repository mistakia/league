import debug from 'debug'

import db from '#db'
import {
  create_player_exposure_table,
  create_wager_summary_table,
  create_lost_by_legs_table,
  create_unique_props_table,
  create_event_exposure_table,
  create_prop_combination_table,
  create_wager_table
} from './wager-table-formatters.mjs'
import {
  format_round_robin_display,
  analyze_fanduel_round_robin_selections,
  analyze_fanatics_wager_sets
} from './round-robin-analysis.mjs'
import {
  filter_wagers_by_lost_legs,
  filter_wagers_excluding_selections,
  filter_wagers_including_selections,
  sort_wagers
} from './wager-filters.mjs'

const log = debug('analyze-wagers')

/**
 * Build player summary from unique selections and print player exposure table if requested.
 *
 * @param {object} params
 * @param {Array} params.unique_selections
 * @param {Array} params.filtered_wagers
 * @param {Object} params.wager_summary
 * @param {boolean} params.show_player_exposure
 */
export const print_player_exposure_if_requested = ({
  unique_selections,
  filtered_wagers,
  wager_summary,
  show_player_exposure
}) => {
  if (!show_player_exposure) return

  const player_summary = unique_selections.reduce((acc, selection) => {
    if (!selection.player_name) return acc

    if (!acc[selection.player_name]) {
      acc[selection.player_name] = {
        exposure_count: 0,
        open_wagers: 0,
        open_potential_payout: 0,
        max_potential_payout: 0,
        props_count: 0
      }
    }

    acc[selection.player_name].exposure_count += selection.exposure_count
    acc[selection.player_name].open_wagers += selection.open_wagers
    acc[selection.player_name].open_potential_payout +=
      selection.open_potential_payout
    acc[selection.player_name].max_potential_payout +=
      selection.max_potential_payout
    acc[selection.player_name].props_count += 1

    return acc
  }, {})

  const player_summary_table = create_player_exposure_table(
    player_summary,
    filtered_wagers.length,
    wager_summary.total_risk
  )
  player_summary_table.printTable()
}

/**
 * Print wager summary and props summary tables.
 *
 * @param {object} params
 * @param {Object} params.wager_summary
 * @param {Object} params.props_summary
 * @param {boolean} params.show_counts
 * @param {boolean} params.show_potential_gain
 */
export const print_summary_tables = ({
  wager_summary,
  props_summary,
  show_counts,
  show_potential_gain
}) => {
  const wager_summary_table = create_wager_summary_table(
    wager_summary,
    props_summary,
    show_counts,
    show_potential_gain
  )
  wager_summary_table.printTable()
}

/**
 * Print round robin analysis if requested.
 *
 * @param {object} params
 * @param {Array} params.fanduel_round_robin_wagers
 * @param {boolean} params.show_round_robins
 */
export const print_round_robin_analysis_if_requested = ({
  fanduel_round_robin_wagers,
  show_round_robins
}) => {
  if (!show_round_robins) return

  console.log(
    `\n\nTotal FanDuel Round Robins: ${fanduel_round_robin_wagers.length}\n`
  )

  fanduel_round_robin_wagers.forEach((wager) => {
    const formatted_display = format_round_robin_display(wager)
    console.log(formatted_display)
    console.log('---')
  })

  analyze_fanduel_round_robin_selections(fanduel_round_robin_wagers)
}

/**
 * Print lost by legs table if counts are requested.
 *
 * @param {object} params
 * @param {Object} params.wager_summary
 * @param {boolean} params.show_counts
 */
export const print_lost_by_legs_if_requested = ({
  wager_summary,
  show_counts
}) => {
  if (!show_counts) return

  const lost_by_legs_summary_table = create_lost_by_legs_table(wager_summary)
  lost_by_legs_summary_table.printTable()
}

/**
 * Print unique props table.
 *
 * @param {object} params
 * @param {Array} params.unique_selections
 * @param {boolean} params.show_counts
 * @param {boolean} params.show_potential_gain
 */
export const print_unique_props_table = ({
  unique_selections,
  show_counts,
  show_potential_gain
}) => {
  const unique_props_table = create_unique_props_table(
    unique_selections,
    show_counts,
    show_potential_gain
  )
  unique_props_table.printTable()
}

/**
 * Build event ID to ESBID mapping and game titles, then print exposures by game.
 *
 * @param {object} params
 * @param {Array} params.wagers
 * @param {Array} params.unique_selections
 * @param {boolean} params.show_counts
 * @param {boolean} params.show_potential_gain
 */
export const print_exposures_by_game = async ({
  wagers,
  unique_selections,
  show_counts,
  show_potential_gain
}) => {
  // Get unique event_ids for each book
  const fanduel_event_ids = new Set(
    wagers
      .filter((w) => w.source_id === 'FANDUEL')
      .flatMap((w) => w.selections.map((s) => s.event_id))
  )
  const draftkings_event_ids = new Set(
    wagers
      .filter((w) => w.source_id === 'DRAFTKINGS')
      .flatMap((w) => w.selections.map((s) => s.event_id))
  )

  // Get mapping of event_id to esbid
  const fanduel_esbid_mapping = await db('prop_markets_index')
    .whereIn('source_event_id', Array.from(fanduel_event_ids))
    .where('source_id', 'FANDUEL')
    .select('source_event_id', 'esbid')

  const draftkings_esbid_mapping = await db('prop_markets_index')
    .whereIn('source_event_id', Array.from(draftkings_event_ids))
    .where('source_id', 'DRAFTKINGS')
    .select('source_event_id', 'esbid')

  // Create a combined mapping
  const event_id_to_esbid = new Map([
    ...fanduel_esbid_mapping.map((row) => [row.source_event_id, row.esbid]),
    ...draftkings_esbid_mapping.map((row) => [row.source_event_id, row.esbid])
  ])

  // Get game titles from nfl_games table
  const esbids = new Set([...event_id_to_esbid.values()])
  const game_titles = await db('nfl_games')
    .whereIn('esbid', Array.from(esbids))
    .select('esbid', db.raw("v || ' @ ' || h AS title"))

  const esbid_to_title = new Map(
    game_titles.map((row) => [row.esbid, row.title])
  )

  // Group selections by esbid
  const grouped_props_by_esbid = unique_selections.reduce(
    (grouped_props, prop) => {
      const esbid = event_id_to_esbid.get(prop.event_id)
      if (!esbid) return grouped_props
      if (!grouped_props[esbid]) {
        grouped_props[esbid] = []
      }
      grouped_props[esbid].push(prop)
      return grouped_props
    },
    {}
  )

  // Print exposures by game
  for (const esbid in grouped_props_by_esbid) {
    const event_title = esbid_to_title.get(Number(esbid)) || 'Unknown Game'
    const event_title_with_esbid = `${event_title} [${esbid}]`
    const event_table = create_event_exposure_table(
      event_title_with_esbid,
      grouped_props_by_esbid[esbid],
      show_counts,
      show_potential_gain
    )
    event_table.printTable()
  }
}

/**
 * Print prop combination tables for near misses.
 *
 * @param {object} params
 * @param {Array} params.one_prop
 * @param {Array} params.two_props
 * @param {Array} params.three_props
 */
export const print_prop_combination_tables = ({
  one_prop,
  two_props,
  three_props
}) => {
  const one_leg_table = create_prop_combination_table(one_prop, 'One Leg Away')
  const two_legs_table = create_prop_combination_table(
    two_props,
    'Two Legs Away'
  )
  const three_legs_table = create_prop_combination_table(
    three_props,
    'Three Legs Away'
  )

  if (one_leg_table) one_leg_table.printTable()
  if (two_legs_table) two_legs_table.printTable()
  if (three_legs_table) three_legs_table.printTable()
}

/**
 * Print individual wager tables if not hidden.
 *
 * @param {object} params
 * @param {Array} params.filtered_wagers
 * @param {Object} params.wager_summary
 * @param {boolean} params.hide_wagers
 * @param {number} params.wagers_lost_leg_limit
 * @param {Array} params.exclude_selections
 * @param {Array} params.include_selections
 * @param {string} params.sort_by
 * @param {number} params.wagers_limit
 * @param {boolean} params.show_wager_roi
 * @param {boolean} params.show_potential_gain
 * @param {boolean} params.show_bet_receipts
 */
export const print_individual_wagers_if_not_hidden = ({
  filtered_wagers,
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
}) => {
  if (hide_wagers) return

  console.log(
    '\n\nTop 50 slips sorted by highest odds (<= specified lost legs)\n\n'
  )

  // Apply filters using filter functions
  let display_wagers = filter_wagers_by_lost_legs(
    filtered_wagers,
    wagers_lost_leg_limit
  )
  log(`filtered_wagers: ${display_wagers.length}`)

  display_wagers = filter_wagers_excluding_selections(
    display_wagers,
    exclude_selections
  )
  display_wagers = filter_wagers_including_selections(
    display_wagers,
    include_selections
  )
  log(`display_wagers: ${display_wagers.length}`)

  const sorted_wagers = sort_wagers(display_wagers, sort_by)

  for (const wager of sorted_wagers.slice(0, wagers_limit)) {
    const wager_table = create_wager_table(wager, {
      show_wager_roi,
      show_potential_gain,
      show_bet_receipts,
      total_risk: wager_summary.total_risk
    })
    wager_table.printTable()
  }
}

/**
 * Print Fanatics sets analysis if requested.
 *
 * @param {object} params
 * @param {Array} params.wagers
 * @param {boolean} params.show_fanatics_sets
 */
export const print_fanatics_sets_if_requested = ({
  wagers,
  show_fanatics_sets
}) => {
  if (!show_fanatics_sets) return

  const fanatics_wagers = wagers.filter((w) => w.source_id === 'FANATICS')
  analyze_fanatics_wager_sets(fanatics_wagers)
}
