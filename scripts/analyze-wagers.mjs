import debug from 'debug'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import * as oddslib from 'oddslib'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { Table } from 'console-table-printer'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('analyze-wagers')
debug.enable('analyze-wagers')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const is_prop_equal = (prop_a, prop_b) =>
  prop_a.event_id === prop_b.event_id &&
  prop_a.market_id === prop_b.market_id &&
  prop_a.selection_id === prop_b.selection_id

const get_props_summary = (props) =>
  props.reduce(
    (accumulator, prop) => {
      const odds = prop.parsed_odds
        ? oddslib.from('moneyline', prop.parsed_odds).to('impliedProbability')
        : 0
      const is_win = prop.is_won
      return {
        total_props: accumulator.total_props + 1,
        expected_hits: accumulator.expected_hits + odds,
        actual_hits: is_win
          ? accumulator.actual_hits + 1
          : accumulator.actual_hits
      }
    },
    {
      expected_hits: 0,
      actual_hits: 0,
      total_props: 0
    }
  )

const get_wagers_summary = ({ wagers, props = [] }) =>
  wagers.reduce(
    (accumulator, wager) => {
      const lost_legs = wager.selections.filter((selection) => {
        for (const prop of props) {
          if (is_prop_equal(selection, prop)) {
            return false
          }
        }
        return selection.is_lost
      }).length

      const is_settled = wager.is_settled

      const is_won = is_settled && lost_legs === 0
      const is_lost = is_settled && lost_legs > 0

      return {
        won_wagers: is_won
          ? [...accumulator.won_wagers, wager]
          : accumulator.won_wagers,
        wagers: accumulator.wagers + 1,
        wagers_won: is_won
          ? accumulator.wagers_won + 1
          : accumulator.wagers_won,
        wagers_loss: is_lost
          ? accumulator.wagers_loss + 1
          : accumulator.wagers_loss,
        wagers_open: is_settled
          ? accumulator.wagers_open
          : accumulator.wagers_open + 1,

        total_risk: accumulator.total_risk + wager.stake,
        total_won: is_won
          ? accumulator.total_won + wager.potential_win
          : accumulator.total_won,
        max_potential_win: accumulator.max_potential_win + wager.potential_win,
        open_potential_win: is_settled
          ? accumulator.open_potential_win
          : accumulator.open_potential_win + wager.potential_win,

        lost_by_one_leg:
          lost_legs === 1
            ? accumulator.lost_by_one_leg + 1
            : accumulator.lost_by_one_leg,
        lost_by_two_legs:
          lost_legs === 2
            ? accumulator.lost_by_two_legs + 1
            : accumulator.lost_by_two_legs,
        lost_by_three_legs:
          lost_legs === 3
            ? accumulator.lost_by_three_legs + 1
            : accumulator.lost_by_three_legs,
        lost_by_four_or_more_legs:
          lost_legs >= 4
            ? accumulator.lost_by_four_or_more_legs + 1
            : accumulator.lost_by_four_or_more_legs
      }
    },
    {
      won_wagers: [],
      wagers: 0,
      wagers_won: 0,
      wagers_loss: 0,
      total_risk: 0,
      wagers_open: 0,
      total_won: 0,
      max_potential_win: 0,
      open_potential_win: 0,
      lost_by_one_leg: 0,
      lost_by_two_legs: 0,
      lost_by_three_legs: 0,
      lost_by_four_or_more_legs: 0
    }
  )

const format_fanduel_selection_name = ({ selection, week }) => {
  const player_name = selection.eventMarketDescription.split(' - ')[0]
  const stat_type = (
    selection.eventMarketDescription.includes(' - ')
      ? selection.eventMarketDescription.split(' - ')[1]
      : selection.eventMarketDescription
  )
    .replace('Alt ', '')
    .trim()
    .replace('Receptions', 'Recs')
    .replace('Passing', 'Pass')
    .replace('Rushing', 'Rush')
    .replace('Receiving', 'Recv')
    .replace('Any Time Touchdown Scorer', 'Anytime TD')
    .replace('To Score 2+ Touchdowns', '2+ TDs')
    .replace('1st Team Touchdown Scorer', '1st Team TD')
  const handicap = Math.round(Number(selection.parsedHandicap))

  let name

  if (
    stat_type === 'Moneyline' ||
    stat_type === 'Anytime TD' ||
    stat_type === '2+ TDs' ||
    stat_type === '1st Team TD'
  ) {
    name = `${selection.selectionName} ${stat_type} [week ${week}]`
  } else if (stat_type === 'Alternate Spread') {
    name = `${selection.selectionName} [week ${week}]`
  } else {
    name = `${player_name} ${handicap}+ ${stat_type} [week ${week}]`
  }

  return name
}

const format_draftkings_selection_name = ({ selection }) => {
  const market_display_name = selection.marketDisplayName || ''
  const selection_display_name = selection.selectionDisplayName || ''

  // List of stat names to check for
  const stat_names = [
    'Rushing Yards',
    'Receiving Yards',
    'Passing Yards',
    'Receptions',
    'Touchdowns'
  ]

  // Extract player name
  const player_name = stat_names.reduce((name, stat) => {
    if (name) return name
    const index = market_display_name.indexOf(stat)
    return index !== -1 ? market_display_name.slice(0, index).trim() : ''
  }, '')

  if (player_name) {
    // Handle specific stats
    if (market_display_name.includes('Rushing Yards')) {
      return `${player_name} ${selection_display_name} Rush Yds`
    }
    if (market_display_name.includes('Receiving Yards')) {
      return `${player_name} ${selection_display_name} Recv Yds`
    }
    if (market_display_name.includes('Passing Yards')) {
      return `${player_name} ${selection_display_name} Pass Yds`
    }
    if (market_display_name.includes('Receptions')) {
      return `${player_name} ${selection_display_name} Recs`
    }
    if (market_display_name.includes('Touchdowns')) {
      return `${player_name} ${selection_display_name} TDs`
    }
  }

  // Default to original format if no specific case is matched
  return `${market_display_name} (${selection_display_name})`
}

const standardize_wager = ({ wager, source }) => {
  if (source === 'fanduel') {
    const week = dayjs(wager.settledDate)
      .subtract('2', 'day')
      .diff(constants.season.start, 'weeks')

    return {
      ...wager,
      week,
      selections: wager.legs.map((leg) => ({
        ...leg.parts[0],
        name: format_fanduel_selection_name({ selection: leg.parts[0], week }),
        event_id: leg.parts[0].eventId,
        market_id: leg.parts[0].marketId,
        source_id: 'FANDUEL',
        selection_id: leg.parts[0].selectionId,
        parsed_odds: Number(leg.parts[0].americanPrice),
        is_won: leg.result === 'WON',
        is_lost: leg.result === 'LOST'
      })),
      bet_receipt_id: wager.betReceiptId.replace(
        /(\d{4})(\d{4})(\d{4})(\d{4})/,
        '$1-$2-$3-$4'
      ),
      parsed_odds: Number(wager.americanBetPrice),
      is_settled: wager.isSettled,
      is_won: wager.result === 'WON',
      potential_win: wager.betPrice * wager.currentSize,
      stake: wager.currentSize,
      source_id: 'FANDUEL'
    }
  } else if (source === 'draftkings') {
    return {
      ...wager,
      selections: wager.selections.map((selection) => ({
        ...selection,
        name: format_draftkings_selection_name({ selection }),
        event_id: selection.eventId,
        market_id: selection.marketId,
        selection_id: selection.selectionId,
        bet_receipt_id: wager.betReceiptId,
        source_id: 'DRAFTKINGS',
        parsed_odds: selection.displayOdds
          ? Number(selection.displayOdds.replace(/—|-|−/g, '-'))
          : null,
        is_won: selection.settlementStatus === 'Won',
        is_lost: selection.settlementStatus === 'Lost'
      })),
      bet_receipt_id: wager.receiptId,
      parsed_odds: Number(wager.displayOdds.replace(/—|-|−/g, '-')),
      is_settled: wager.status === 'Settled',
      is_won: wager.settlementStatus === 'Won',
      potential_win: wager.potentialReturns,
      stake: wager.stake,
      source_id: 'DRAFTKINGS'
    }
  }
  throw new Error(`Unknown wager source: ${source}`)
}

const analyze_wagers = async ({
  fanduel_filename,
  draftkings_filename,
  week,
  show_potential_gain = false,
  show_counts = false,
  show_bet_receipts = false,
  wagers_limit = Infinity,
  hide_wagers = false,
  wagers_lost_leg_limit = 1,
  filter_wagers_min_legs = 0,
  include_selections = [],
  exclude_selections = []
} = {}) => {
  if (!fanduel_filename && !draftkings_filename) {
    throw new Error('At least one filename (FanDuel or DraftKings) is required')
  }

  log({
    fanduel_filename,
    draftkings_filename,
    week,
    show_potential_gain,
    show_counts,
    show_bet_receipts,
    wagers_limit,
    wagers_lost_leg_limit,
    include_selections,
    exclude_selections
  })

  let wagers = []

  if (fanduel_filename) {
    const fanduel_wagers = await fs.readJson(`${data_path}/${fanduel_filename}`)
    wagers = wagers.concat(
      fanduel_wagers.map((wager) =>
        standardize_wager({ wager, source: 'fanduel' })
      )
    )
  }

  if (draftkings_filename) {
    const draftkings_wagers = await fs.readJson(
      `${data_path}/${draftkings_filename}`
    )
    wagers = wagers.concat(
      draftkings_wagers.map((wager) =>
        standardize_wager({ wager, source: 'draftkings' })
      )
    )
  }

  const filtered = wagers.filter((wager) => {
    if (week) {
      return wager.week === week
    }
    return true
  })

  const wager_summary = get_wagers_summary({ wagers: filtered })
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

      const key = `${selection.event_id}/${selection.market_id}/${selection.selection_id}`
      if (!selections_index[key]) {
        selections_index[key] = {
          ...selection,
          exposure_count: 0,
          open_wagers: 0,
          open_potential_payout: 0,
          max_potential_payout: 0,
          week: dayjs(selection.start_time)
            .subtract(2, 'day')
            .diff(constants.season.start, 'weeks')
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

  const props_summary = get_props_summary(unique_selections)
  const wager_summary_table = new Table({ title: 'Execution Summary' })

  const add_row = (label, value) => {
    if (typeof value === 'number') {
      if (label.includes('Potential Win')) {
        value = value.toLocaleString('en-US', { maximumFractionDigits: 2 })
      } else if (label === 'Expected Hits') {
        value = value.toFixed(2)
      }
    }
    wager_summary_table.addRow({ Metric: label, Value: value })
  }

  add_row('Current ROI', wager_summary.current_roi)
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
    add_row(
      key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value
    )
  }

  if (show_counts) {
    add_row('Wagers', wager_summary.wagers)
    add_row('Total Won', wager_summary.total_won)
    // add_row('Wagers Won', wager_summary.wagers_won)
    // add_row('Wagers Loss', wager_summary.wagers_loss)
    add_row('Wagers Open', wager_summary.wagers_open)
    add_row('Total Risk Units', wager_summary.total_risk)
  }

  if (show_potential_gain) {
    add_row('Open Potential Win', wager_summary.open_potential_win)
    add_row('Max Potential Win', wager_summary.max_potential_win)
  }

  wager_summary_table.printTable()

  if (show_counts) {
    const lost_by_legs_summary_table = new Table({
      title: 'Wagers Lost By # Legs'
    })
    lost_by_legs_summary_table.addRow({
      1: wager_summary.lost_by_one_leg,
      2: wager_summary.lost_by_two_legs,
      3: wager_summary.lost_by_three_legs,
      '4+': wager_summary.lost_by_four_or_more_legs
    })
    lost_by_legs_summary_table.printTable()
  }

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
    }
    result.open_potential_roi = prop.open_potential_roi
    result.max_potential_roi = prop.max_potential_roi

    if (show_potential_gain) {
      result.max_potential_payout = prop.max_potential_payout.toFixed(2)
    }

    return result
  })

  props_with_exposure.forEach((prop) => unique_props_table.addRow(prop))
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
    const event_table = new Table({
      title: esbid_to_title.get(Number(esbid)) || 'Unknown Game'
    })
    grouped_props_by_esbid[esbid]
      .sort((a, b) => b.exposure_count - a.exposure_count)
      .forEach((prop) => {
        const row = {
          name: prop.name,
          odds: prop.parsed_odds,
          exposure_rate: prop.exposure_rate,
          result: prop.result,
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

        event_table.addRow(row)
      })
    event_table.printTable()
  }

  const one_prop = []
  const two_props = []

  const lost_props = unique_selections.filter((prop) => prop.is_lost)

  for (let i = 0; i < lost_props.length; i++) {
    const prop_a = lost_props[i]

    const one_prop_summary = get_wagers_summary({
      wagers: filtered,
      props: [prop_a]
    })
    const potential_gain = one_prop_summary.total_won - wager_summary.total_won
    const potential_wins =
      one_prop_summary.wagers_won - wager_summary.wagers_won
    const potential_roi_added =
      (potential_gain / wager_summary.total_risk) * 100

    if (potential_gain) {
      one_prop.push({
        name: prop_a.name,
        potential_gain,
        potential_wins,
        potential_roi_added
      })
    }

    for (let j = i + 1; j < lost_props.length; j++) {
      const prop_b = lost_props[j]

      const two_prop_summary = get_wagers_summary({
        wagers: filtered,
        props: [prop_a, prop_b]
      })
      const potential_gain =
        two_prop_summary.total_won - wager_summary.total_won
      const potential_wins =
        two_prop_summary.wagers_won - wager_summary.wagers_won
      const potential_roi_added =
        (potential_gain / wager_summary.total_risk) * 100

      if (potential_gain) {
        two_props.push({
          name: `${prop_a.name} / ${prop_b.name}`,
          potential_gain,
          potential_wins,
          potential_roi_added
        })
      }
    }
  }

  if (one_prop.length) {
    const one_prop_table = new Table({ title: 'One Leg Away' })
    for (const prop of one_prop.sort(
      (a, b) => b.potential_gain - a.potential_gain
    )) {
      one_prop_table.addRow({
        name: prop.name,
        potential_roi_added: `${prop.potential_roi_added.toFixed(2)}%`,
        potential_gain: prop.potential_gain.toFixed(2),
        potential_wins: prop.potential_wins
      })
    }
    one_prop_table.printTable()
  }

  if (two_props.length) {
    const two_prop_table = new Table({ title: 'Two Legs Away' })
    for (const prop of two_props.sort(
      (a, b) => b.potential_gain - a.potential_gain
    )) {
      two_prop_table.addRow({
        name: prop.name,
        potential_roi_added: `${prop.potential_roi_added.toFixed(2)}%`,
        potential_gain: prop.potential_gain.toFixed(2),
        potential_wins: prop.potential_wins
      })
    }
    two_prop_table.printTable()
  }

  if (!hide_wagers) {
    console.log(
      '\n\nTop 50 slips sorted by highest odds (<= specified lost legs)\n\n'
    )

    const filtered_wagers = filtered.filter((wager) => {
      const lost_legs = wager.selections.filter(
        (selection) => selection.is_lost
      ).length
      return lost_legs <= wagers_lost_leg_limit
    })

    log(`filtered_wagers: ${filtered_wagers.length}`)

    const display_wagers = filtered_wagers.filter((wager) => {
      // Filter out wagers that include any of the excluded selections
      if (exclude_selections.length > 0) {
        if (
          wager.selections.some((selection) =>
            exclude_selections.some((filter) =>
              selection.name.toLowerCase().includes(filter.toLowerCase())
            )
          )
        ) {
          return false
        }
      }

      // Filter to only include wagers that have all of the included selections
      if (include_selections.length > 0) {
        return include_selections.every((filter) =>
          wager.selections.some((selection) =>
            selection.name.toLowerCase().includes(filter.toLowerCase())
          )
        )
      }

      return true
    })

    log(`display_wagers: ${display_wagers.length}`)

    for (const wager of display_wagers
      // .sort((a, b) => b.potential_win - a.potential_win)
      .sort((a, b) => b.parsed_odds - a.parsed_odds)
      .slice(0, wagers_limit)) {
      const potential_roi_gain =
        (wager.potential_win / wager_summary.total_risk) * 100
      const num_of_legs = wager.selections.length
      let wager_table_title = `[${num_of_legs} leg parlay] American odds: ${
        wager.parsed_odds > 0 ? '+' : ''
      }${wager.parsed_odds} / ${potential_roi_gain.toFixed(2)}% roi`

      if (show_potential_gain) {
        wager_table_title += ` ($${wager.potential_win.toFixed(2)})`
      }

      if (show_bet_receipts && wager.bet_receipt_id) {
        wager_table_title += ` / Bet Receipt: ${wager.bet_receipt_id}`
      }

      wager_table_title += ` [Week ${wager.week}]`

      const wager_table = new Table({ title: wager_table_title })
      for (const selection of wager.selections) {
        wager_table.addRow({
          selection: selection.name,
          odds: selection.parsed_odds,
          result: selection.is_won ? 'WON' : selection.is_lost ? 'LOST' : 'OPEN'
        })
      }
      wager_table.printTable()
    }
  }
}

const main = async () => {
  let error
  try {
    await analyze_wagers({
      fanduel_filename: argv.fanduel,
      draftkings_filename: argv.draftkings,
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
      filter_wagers_min_legs: argv.min_legs
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
