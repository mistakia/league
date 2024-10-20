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
  const format_single_selection = (sel) => {
    const market_display_name = sel.marketDisplayName || ''
    const selection_display_name = sel.selectionDisplayName || ''

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

  if (selection.nestedSGPSelections) {
    // Handle nested SGP selections
    const formatted_selections = selection.nestedSGPSelections.map(
      format_single_selection
    )
    return formatted_selections.join(' / ')
  } else {
    // Handle single selection
    return format_single_selection(selection)
  }
}

// Helper function to generate combinations
const generate_round_robin_combinations = (arr, r) => {
  const combinations = []
  const combine = (start, combo) => {
    if (combo.length === r) {
      combinations.push(combo)
      return
    }
    for (let i = start; i < arr.length; i++) {
      combine(i + 1, [...combo, arr[i]])
    }
  }
  combine(0, [])
  return combinations
}

const calculate_fanduel_round_robin_wager = ({ wager }) => {
  const num_selections = Number(wager.betType.slice(3))
  const legs = wager.legs

  // Generate all possible combinations
  const all_combinations = generate_round_robin_combinations(legs, num_selections)

  // Filter combinations to include only one selection per market and event
  const valid_combinations = all_combinations.filter((combination) => {
    const markets = new Set()
    const events = new Set()
    for (const leg of combination) {
      const market_id = leg.parts[0].marketId
      const event_id = leg.parts[0].eventId
      if (markets.has(market_id) || events.has(event_id)) {
        return false
      }
      markets.add(market_id)
      events.add(event_id)
    }
    return true
  })

  // Calculate potential win for each combination
  const stake_per_combination = wager.currentSize / valid_combinations.length
  const round_robin_wagers = valid_combinations.map((combination) => {
    const odds_product = combination.reduce((product, leg) => {
      return product * (1 + Number(leg.parts[0].price) - 1)
    }, 1)
    const potential_win = stake_per_combination * odds_product

    return {
      stake: stake_per_combination,
      potential_win,
      parsed_odds: (odds_product - 1) * 100, // Convert to American odds
      selections: combination.map((leg) => ({
        ...leg.parts[0],
        name: format_fanduel_selection_name({
          selection: leg.parts[0],
          week: wager.week
        }),
        event_id: leg.parts[0].eventId,
        market_id: leg.parts[0].marketId,
        source_id: 'FANDUEL',
        selection_id: leg.parts[0].selectionId,
        parsed_odds: Number(leg.parts[0].americanPrice),
        is_won: leg.result === 'WON',
        is_lost: leg.result === 'LOST'
      })),
      bet_receipt_id: `${wager.betReceiptId}-${combination.map((leg) => leg.parts[0].selectionId).join('-')}`,
      is_settled: wager.isSettled,
      is_won: combination.every((leg) => leg.result === 'WON'),
      source_id: 'FANDUEL'
    }
  })

  return round_robin_wagers
}

const standardize_wager = ({ wager, source }) => {
  if (source === 'fanduel') {
    const week = dayjs(wager.settledDate)
      .subtract('2', 'day')
      .diff(constants.season.start, 'weeks')

    // check if the wager is a round robin
    if (wager.numLines > 1) {
      const round_robin_wagers = calculate_fanduel_round_robin_wager({
        wager: { ...wager, week }
      })
      if (round_robin_wagers.length !== wager.numLines) {
        log({
          round_robin_wagers: round_robin_wagers[0],
          total_combinations: round_robin_wagers.length,
          numLines: wager.numLines
        })
        process.exit()
      }
      return round_robin_wagers
    }

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
    if (wager.type === 'RoundRobin') {
      return wager.combinations.map((combination) => {
        const selections = combination.selectionsMapped.map((selectionId) => {
          const selection =
            wager.selections.find((s) => s.selectionId === selectionId) ||
            wager.selections.find(
              (s) =>
                s.nestedSGPSelections &&
                s.nestedSGPSelections.some(
                  (ns) => ns.selectionId === selectionId
                )
            )

          if (!selection) {
            throw new Error(`Selection not found for ID: ${selectionId}`)
          }

          const standardized_selection = {
            name: format_draftkings_selection_name({
              selection: selection.nestedSGPSelections ? selection : selection
            }),
            event_id: selection.eventId,
            market_id: selection.marketId,
            selection_id: selection.selectionId,
            bet_receipt_id: wager.receiptId,
            source_id: 'DRAFTKINGS',
            result: selection.settlementStatus.toUpperCase(),
            parsed_odds: selection.displayOdds
              ? Number(selection.displayOdds.replace(/—|-|−/g, '-'))
              : null,
            is_won: selection.settlementStatus === 'Won',
            is_lost: selection.settlementStatus === 'Lost'
          }

          if (selection.nestedSGPSelections) {
            standardized_selection.nested_selections =
              selection.nestedSGPSelections.map((ns) => ({
                ...ns,
                name: format_draftkings_selection_name({ selection: ns }),
                parsed_odds: ns.displayOdds
                  ? Number(ns.displayOdds.replace(/—|-|−/g, '-'))
                  : null,
                is_won: ns.settlementStatus === 'Won',
                is_lost: ns.settlementStatus === 'Lost'
              }))
          }

          return standardized_selection
        })

        const stake = wager.stake / wager.numberOfBets

        return {
          ...wager,
          selections,
          bet_receipt_id: `${wager.receiptId}-${combination.id}`,
          parsed_odds: Number(combination.displayOdds.replace(/\+/g, '')),
          is_settled: wager.status === 'Settled',
          is_won: combination.status === 'Won',
          potential_win: wager.potentialReturns,
          stake,
          source_id: 'DRAFTKINGS'
        }
      })
    } else {
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
          result: selection.settlementStatus.toUpperCase(),
          parsed_odds: selection.displayOdds
            ? Number(selection.displayOdds.replace(/—|-|−/g, '-'))
            : null,
          is_won: selection.settlementStatus === 'Won',
          is_lost: selection.settlementStatus === 'Lost'
        })),
        bet_receipt_id: wager.receiptId,
        parsed_odds: wager.displayOdds
          ? Number(wager.displayOdds.replace(/—|-|−/g, '-'))
          : null,
        is_settled: wager.status === 'Settled',
        is_won: wager.settlementStatus === 'Won',
        potential_win: wager.potentialReturns,
        stake: wager.stake,
        source_id: 'DRAFTKINGS'
      }
    }
  }
  throw new Error(`Unknown wager source: ${source}`)
}

const analyze_prop_combinations = (lost_props, filtered, wager_summary) => {
  const one_prop = []
  const two_props = []
  const three_props = []

  const prop_summaries = new Map()

  const get_prop_summary = (props) => {
    const key = props
      .map((p) => p.name)
      .sort()
      .join('|')
    if (!prop_summaries.has(key)) {
      prop_summaries.set(
        key,
        get_wagers_summary({
          wagers: filtered,
          props
        })
      )
    }
    return prop_summaries.get(key)
  }

  const calculate_potential_gain = (summary) => {
    return {
      potential_gain: summary.total_won - wager_summary.total_won,
      potential_wins: summary.wagers_won - wager_summary.wagers_won,
      potential_roi_added:
        ((summary.total_won - wager_summary.total_won) /
          wager_summary.total_risk) *
        100
    }
  }

  // Single prop analysis
  for (const prop of lost_props) {
    const summary = get_prop_summary([prop])
    const { potential_gain, potential_wins, potential_roi_added } =
      calculate_potential_gain(summary)

    if (potential_gain > 0) {
      one_prop.push({
        name: prop.name,
        potential_gain,
        potential_wins,
        potential_roi_added
      })
    }
  }

  const processed_combinations = new Set()

  for (let i = 0; i < lost_props.length - 1; i++) {
    for (let j = i + 1; j < lost_props.length; j++) {
      const two_prop_key = [lost_props[i].name, lost_props[j].name]
        .sort()
        .join('|')
      const individual_gains = [
        get_prop_summary([lost_props[i]]).total_won,
        get_prop_summary([lost_props[j]]).total_won
      ]

      if (!processed_combinations.has(two_prop_key)) {
        processed_combinations.add(two_prop_key)
        const two_prop_summary = get_prop_summary([
          lost_props[i],
          lost_props[j]
        ])
        const { potential_gain, potential_wins, potential_roi_added } =
          calculate_potential_gain(two_prop_summary)

        if (
          potential_gain > 0 &&
          two_prop_summary.total_won > Math.max(...individual_gains)
        ) {
          two_props.push({
            name: `${lost_props[i].name} / ${lost_props[j].name}`,
            potential_gain,
            potential_wins,
            potential_roi_added
          })
        }
      }

      // Three prop combinations
      for (let k = j + 1; k < lost_props.length; k++) {
        const three_prop_key = [
          lost_props[i].name,
          lost_props[j].name,
          lost_props[k].name
        ]
          .sort()
          .join('|')
        if (!processed_combinations.has(three_prop_key)) {
          processed_combinations.add(three_prop_key)
          const three_prop_summary = get_prop_summary([
            lost_props[i],
            lost_props[j],
            lost_props[k]
          ])
          const three_prop_result = calculate_potential_gain(three_prop_summary)

          const two_prop_gains = [
            get_prop_summary([lost_props[i], lost_props[j]]).total_won,
            get_prop_summary([lost_props[i], lost_props[k]]).total_won,
            get_prop_summary([lost_props[j], lost_props[k]]).total_won
          ]

          if (
            three_prop_result.potential_gain > 0 &&
            three_prop_summary.total_won >
              Math.max(...two_prop_gains, ...individual_gains)
          ) {
            three_props.push({
              name: `${lost_props[i].name} / ${lost_props[j].name} / ${lost_props[k].name}`,
              ...three_prop_result
            })
          }
        }
      }
    }
  }

  return { one_prop, two_props, three_props }
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
  exclude_selections = [],
  sort_by = 'odds'
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
    exclude_selections,
    sort_by
  })

  let wagers = []

  if (fanduel_filename) {
    const fanduel_wagers = await fs.readJson(`${data_path}/${fanduel_filename}`)
    wagers = wagers.concat(
      fanduel_wagers.flatMap((wager) =>
        standardize_wager({ wager, source: 'fanduel' })
      )
    )
  }

  if (draftkings_filename) {
    const draftkings_wagers = await fs.readJson(
      `${data_path}/${draftkings_filename}`
    )
    wagers = wagers.concat(
      draftkings_wagers.flatMap((wager) => {
        const standardized_wager = standardize_wager({
          wager,
          source: 'draftkings'
        })
        return standardized_wager
      })
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
    add_row('Total Risk', wager_summary.total_risk)
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

  const lost_props = unique_selections.filter((prop) => prop.is_lost)
  const { one_prop, two_props, three_props } = analyze_prop_combinations(
    lost_props,
    filtered,
    wager_summary
  )

  // Display results
  const display_prop_table = (props, title) => {
    if (props.length) {
      const table = new Table({ title })
      for (const prop of props.sort(
        (a, b) => b.potential_gain - a.potential_gain
      )) {
        table.addRow({
          name: prop.name,
          potential_roi_added: `${prop.potential_roi_added.toFixed(2)}%`,
          potential_gain: prop.potential_gain.toFixed(2),
          potential_wins: prop.potential_wins
        })
      }
      table.printTable()
    }
  }

  display_prop_table(one_prop, 'One Leg Away')
  display_prop_table(two_props, 'Two Legs Away')
  display_prop_table(three_props, 'Three Legs Away')

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

    const sorted_wagers = display_wagers.sort((a, b) => {
      if (sort_by === 'payout') {
        return b.potential_win - a.potential_win
      }
      return b.parsed_odds - a.parsed_odds
    })

    for (const wager of sorted_wagers.slice(0, wagers_limit)) {
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
      filter_wagers_min_legs: argv.min_legs,
      sort_by: argv.sort_by || 'odds'
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
