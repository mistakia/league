import debug from 'debug'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'
import {
  standardize_wager_by_source,
  calculate_wager_summary,
  calculate_props_summary,
  analyze_prop_near_miss_combinations,
  format_round_robin_display,
  analyze_fanduel_round_robin_selections,
  analyze_fanatics_wager_sets,
  filter_wagers_by_lost_legs,
  filter_wagers_excluding_selections,
  filter_wagers_including_selections,
  sort_wagers,
  create_player_exposure_table,
  create_wager_summary_table,
  create_lost_by_legs_table,
  create_unique_props_table,
  create_event_exposure_table,
  create_prop_combination_table,
  create_wager_table
} from '#libs-server/wager-analysis/index.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('analyze-wagers')
debug.enable('analyze-wagers')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

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
  filter_wagers_min_legs = 0,
  include_selections = [],
  exclude_selections = [],
  sort_by = 'odds',
  show_wager_roi = false,
  show_only_open_round_robins = false,
  show_round_robins = false,
  show_fanatics_sets = false,
  show_player_exposure = false
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

  let wagers = []
  let fanduel_round_robin_wagers = []

  if (fanduel_filename) {
    try {
      const fanduel_wagers = await fs.readJson(
        `${data_path}/${fanduel_filename}`
      )
      wagers = wagers.concat(
        fanduel_wagers.flatMap((wager) =>
          standardize_wager_by_source({ wager, source: 'fanduel' })
        )
      )
      fanduel_round_robin_wagers = fanduel_wagers.filter((wager) => {
        const is_round_robin = wager.numLines > 1
        if (show_only_open_round_robins) {
          return is_round_robin && wager.potentialWin > 0
        }
        return is_round_robin
      })
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(
          `Warning: FanDuel file '${fanduel_filename}' not found. Skipping FanDuel wagers.`
        )
      } else {
        throw error // Re-throw if it's not a file not found error
      }
    }
  }

  if (draftkings_filename) {
    try {
      const draftkings_wagers = await fs.readJson(
        `${data_path}/${draftkings_filename}`
      )
      wagers = wagers.concat(
        draftkings_wagers.flatMap((wager) => {
          const standardized_wager = standardize_wager_by_source({
            wager,
            source: 'draftkings'
          })
          return standardized_wager
        })
      )
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(
          `Warning: DraftKings file '${draftkings_filename}' not found. Skipping DraftKings wagers.`
        )
      } else {
        throw error // Re-throw if it's not a file not found error
      }
    }
  }

  if (fanatics_filename) {
    try {
      const fanatics_wagers = await fs.readJson(
        `${data_path}/${fanatics_filename}`
      )
      wagers = wagers.concat(
        fanatics_wagers.flatMap((wager) =>
          standardize_wager_by_source({ wager, source: 'fanatics' })
        )
      )
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(
          `Warning: Fanatics file '${fanatics_filename}' not found. Skipping Fanatics wagers.`
        )
      } else {
        throw error
      }
    }
  }

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

  const selections_index = {}
  const event_index = {}

  for (const wager of filtered) {
    for (const selection of wager.selections) {
      if (!event_index[selection.event_id]) {
        event_index[selection.event_id] = selection.event_description
      }

      // Use event_id + selection_id as key (not market_id) because FanDuel can assign
      // multiple market IDs to the same selection (same player, threshold, outcome)
      const key = `${selection.event_id}/${selection.selection_id}`
      if (!selections_index[key]) {
        selections_index[key] = {
          ...selection,
          exposure_count: 0,
          open_wagers: 0,
          open_potential_payout: 0,
          max_potential_payout: 0,
          week: dayjs(selection.start_time)
            .subtract(2, 'day')
            .diff(constants.season.regular_season_start, 'weeks')
        }
      }

      selections_index[key].exposure_count += 1
      selections_index[key].max_potential_payout += wager.potential_win

      if (!wager.is_settled) {
        selections_index[key].open_wagers += 1
        selections_index[key].open_potential_payout += wager.potential_win
      }
    }
  }

  // Enrich selections with actual metric results from database
  const selection_keys_by_source = {
    FANDUEL: [],
    DRAFTKINGS: [],
    FANATICS: []
  }

  // Group selection keys by source
  for (const [key, selection] of Object.entries(selections_index)) {
    const source = selection.source_id
    if (selection_keys_by_source[source]) {
      selection_keys_by_source[source].push({
        key,
        event_id: selection.event_id,
        selection_id: selection.selection_id
      })
    }
  }

  // Query database for each source
  const results_map = new Map()

  for (const [source, selections] of Object.entries(selection_keys_by_source)) {
    if (selections.length === 0) continue

    // Build arrays for batch query
    const selection_ids = selections.map((s) => s.selection_id)
    const event_ids = [...new Set(selections.map((s) => s.event_id))]

    // Query with both selection_id and event_id constraints to handle market ID mismatches
    const db_results = await db('prop_market_selections_index as pms')
      .join('prop_markets_index as pm', function () {
        this.on('pms.source_id', '=', 'pm.source_id')
        this.on('pms.source_market_id', '=', 'pm.source_market_id')
      })
      .where('pms.source_id', source)
      .whereIn('pms.source_selection_id', selection_ids)
      .whereIn('pm.source_event_id', event_ids)
      .select(
        'pms.source_selection_id',
        'pm.source_event_id',
        'pm.metric_result_value',
        'pms.selection_metric_line',
        'pms.selection_type'
      )

    // Map results using event_id/selection_id as key
    for (const row of db_results) {
      const key = `${row.source_event_id}/${row.source_selection_id}`
      // Only store if not already found (avoid duplicates from multiple markets)
      if (!results_map.has(key)) {
        results_map.set(key, {
          metric_result_value: row.metric_result_value,
          selection_metric_line: row.selection_metric_line,
          selection_type: row.selection_type
        })
      }
    }
  }

  // Calculate matching statistics after all queries complete
  const matching_stats = {
    total_selections: Object.keys(selections_index).length,
    found_in_db: 0,
    with_results: 0,
    pending: 0,
    not_found: 0
  }

  for (const key of Object.keys(selections_index)) {
    const db_result = results_map.get(key)
    if (db_result) {
      matching_stats.found_in_db++
      if (db_result.metric_result_value !== null) {
        matching_stats.with_results++
      } else {
        matching_stats.pending++
      }
    } else {
      matching_stats.not_found++
    }
  }

  // Log matching statistics
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

  // Enhance selections_index with database results
  for (const [key] of Object.entries(selections_index)) {
    const db_result = results_map.get(key)
    if (db_result) {
      selections_index[key].metric_result_value = db_result.metric_result_value
      selections_index[key].selection_metric_line =
        db_result.selection_metric_line
      selections_index[key].selection_type = db_result.selection_type

      // Calculate distance from threshold
      if (
        db_result.metric_result_value !== null &&
        db_result.selection_metric_line !== null
      ) {
        selections_index[key].distance_from_threshold =
          Number(db_result.metric_result_value) -
          Number(db_result.selection_metric_line)
      }
    }
  }

  // Enrich wager selections with database results
  for (const wager of filtered) {
    for (const selection of wager.selections) {
      const key = `${selection.event_id}/${selection.selection_id}`
      const enriched = selections_index[key]
      if (enriched) {
        selection.metric_result_value = enriched.metric_result_value
        selection.selection_metric_line = enriched.selection_metric_line
        selection.selection_type = enriched.selection_type
        selection.distance_from_threshold = enriched.distance_from_threshold
      }
    }
  }

  const unique_selections = Object.values(selections_index)
    .map((selection) => {
      return {
        ...selection,
        name: selection.name,
        exposure_rate: `${((selection.exposure_count / filtered.length) * 100).toFixed(2)}%`,
        open_potential_roi: `${((selection.open_potential_payout / wager_summary.total_risk) * 100).toFixed(0)}%`,
        max_potential_roi: `${((selection.max_potential_payout / wager_summary.total_risk) * 100).toFixed(0)}%`
      }
    })
    .sort((a, b) => b.exposure_count - a.exposure_count)

  // Build player summary from selections
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

  // Create and print player exposure table
  if (show_player_exposure) {
    const player_summary_table = create_player_exposure_table(
      player_summary,
      filtered.length,
      wager_summary.total_risk
    )
    player_summary_table.printTable()
  }

  const props_summary = calculate_props_summary(unique_selections)

  // Create and print wager summary table
  const wager_summary_table = create_wager_summary_table(
    wager_summary,
    props_summary,
    show_counts,
    show_potential_gain
  )
  wager_summary_table.printTable()

  if (show_round_robins) {
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

  if (show_counts) {
    const lost_by_legs_summary_table = create_lost_by_legs_table(wager_summary)
    lost_by_legs_summary_table.printTable()
  }

  // Create and print unique props table
  const unique_props_table = create_unique_props_table(
    unique_selections,
    show_counts,
    show_potential_gain
  )
  unique_props_table.printTable()

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

  const lost_props = unique_selections.filter((prop) => prop.is_lost)
  const { one_prop, two_props, three_props } =
    analyze_prop_near_miss_combinations(lost_props, filtered, wager_summary)

  // Display prop combination tables
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

  if (!hide_wagers) {
    console.log(
      '\n\nTop 50 slips sorted by highest odds (<= specified lost legs)\n\n'
    )

    // Apply filters using filter functions
    let display_wagers = filter_wagers_by_lost_legs(
      filtered,
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

  if (show_fanatics_sets) {
    const fanatics_wagers = wagers.filter((w) => w.source_id === 'FANATICS')
    analyze_fanatics_wager_sets(fanatics_wagers)
  }
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
      filter_wagers_min_legs: argv.min_legs,
      sort_by: argv.sort_by || 'odds',
      show_wager_roi: argv.show_wager_roi,
      show_only_open_round_robins: argv.show_only_open_round_robins,
      show_round_robins: argv.show_round_robins,
      show_fanatics_sets: argv.show_fanatics_sets,
      show_player_exposure: argv.show_player_exposure
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
