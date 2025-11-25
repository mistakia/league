import debug from 'debug'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import * as oddslib from 'oddslib'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { Table } from 'console-table-printer'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
// import { job_types } from '#libs-shared/job-constants.mjs'

// import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('analyze-fanduel-wagers')
debug.enable('analyze-fanduel-wagers')

/**
 * Update the count of wagers lost by a specific number of legs.
 * Creates a new object to maintain immutability in the reducer.
 *
 * @param {Object} lost_by_legs - Current counts object {1: count, 2: count, ...}
 * @param {boolean} is_lost - Whether the wager was lost
 * @param {number} lost_legs - Number of losing selections in the wager
 * @returns {Object} Updated counts object
 */
const update_lost_by_legs_count = (lost_by_legs, is_lost, lost_legs) => {
  const updated = { ...lost_by_legs }
  if (is_lost && lost_legs > 0) {
    updated[lost_legs] = (updated[lost_legs] || 0) + 1
  }
  return updated
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const is_prop_equal = (prop_a, prop_b) =>
  prop_a.eventId === prop_b.eventId &&
  prop_a.marketId === prop_b.marketId &&
  prop_a.selectionId === prop_b.selectionId

const get_props_summary = (props) =>
  props.reduce(
    (accumulator, prop) => {
      const odds = oddslib.from('moneyline', prop.americanPrice)
      const is_win = prop.result === 'WON'
      return {
        total_selections: accumulator.total_selections + 1,
        market_implied_hits:
          accumulator.market_implied_hits + odds.to('impliedProbability'),
        actual_hits: is_win
          ? accumulator.actual_hits + 1
          : accumulator.actual_hits
      }
    },
    {
      market_implied_hits: 0,
      actual_hits: 0,
      total_selections: 0
    }
  )

const get_wagers_summary = ({ wagers, props = [] }) =>
  wagers.reduce(
    (accumulator, wager) => {
      const lost_legs = wager.legs.filter((leg) => {
        for (const prop of props) {
          if (is_prop_equal(leg.parts[0], prop)) {
            return false
          }
        }
        return leg.result === 'LOST'
      }).length

      const total_return = wager.betPrice
        ? Number(wager.betPrice * wager.currentSize)
        : Number(wager.potentialWin)
      const is_won = wager.isSettled && lost_legs === 0
      const is_lost = wager.isSettled && !is_won

      return {
        wagers: accumulator.wagers + 1,
        wagers_won: is_won
          ? accumulator.wagers_won + 1
          : accumulator.wagers_won,
        wagers_loss: is_lost
          ? accumulator.wagers_loss + 1
          : accumulator.wagers_loss,
        wagers_open: wager.isSettled
          ? accumulator.wagers_open
          : accumulator.wagers_open + 1,

        total_risk: accumulator.total_risk + wager.currentSize,
        total_won: is_won
          ? accumulator.total_won + (wager.pandl || total_return)
          : accumulator.total_won,
        max_potential_win: accumulator.max_potential_win + total_return,
        open_potential_win:
          accumulator.open_potential_win + Number(wager.potentialWin),

        // Track lost legs dynamically - count wagers by number of losing selections
        lost_by_legs: update_lost_by_legs_count(
          accumulator.lost_by_legs,
          is_lost,
          lost_legs
        )
      }
    },
    {
      wagers: 0,
      wagers_won: 0,
      wagers_loss: 0,
      wagers_open: 0,
      total_risk: 0,
      total_won: 0,
      max_potential_win: 0,
      open_potential_win: 0,
      lost_by_legs: {}
    }
  )

const analyze_fanduel_wagers = async ({
  filename,
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
  if (!filename) {
    throw new Error('filename is required')
  }

  log({
    filename,
    week,
    show_potential_gain,
    show_counts,
    show_bet_receipts,
    wagers_limit,
    wagers_lost_leg_limit,
    include_selections,
    exclude_selections
  })

  const json_file_path = `${data_path}/${filename}`
  log(`loading wagers from ${json_file_path}`)
  const wagers = await fs.readJson(json_file_path)

  for (const wager of wagers) {
    wager.week = dayjs(wager.settledDate)
      .subtract('2', 'day')
      .diff(constants.season.regular_season_start, 'weeks')
  }

  const filtered = wagers.filter((wager) => {
    // filter out wagers with less than the minimum number of legs
    if (wager.legs.length < filter_wagers_min_legs) {
      return false
    }

    if (week) {
      return wager.week === week
    }

    return true
  })

  const wager_legs = filtered.map((wager) => wager.legs).flat()
  const wager_parts = wager_legs.map((legs) => legs.parts).flat()
  const market_selection_index = {}
  const event_index = {}
  const wager_summary = get_wagers_summary({ wagers: filtered })

  const props = wager_parts
    .filter((leg) => {
      if (!event_index[leg.eventId]) {
        event_index[leg.eventId] = leg.eventDescription
      }

      const key = `${leg.eventId}/${leg.marketId}/${leg.selectionId}`
      if (market_selection_index[key]) {
        return false
      }

      market_selection_index[key] = true

      return true
    })
    .map((leg) => {
      const week = dayjs(leg.startTime)
        .subtract('2', 'day')
        .diff(constants.season.regular_season_start, 'weeks')

      let max_potential_payout = 0
      let open_potential_payout = 0
      let open_wagers = 0
      let exposure_count = 0

      for (const wager of filtered) {
        for (const wager_leg of wager.legs) {
          if (is_prop_equal(wager_leg.parts[0], leg)) {
            if (!wager.isSettled) {
              open_wagers += 1
            }
            open_potential_payout += Number(wager.potentialWin)
            max_potential_payout +=
              Number(wager.currentSize) *
              (Number(wager.betPrices.betPrice.decimalPrice) || 0)
            exposure_count += 1

            break
          }
        }
      }

      const player_name = leg.eventMarketDescription.split(' - ')[0]
      const stat_type = (
        leg.eventMarketDescription.includes(' - ')
          ? leg.eventMarketDescription.split(' - ')[1]
          : leg.eventMarketDescription
      )
        .replace('Alt ', '')
        .trim()
        .replace('Receptions', 'Recs')
        .replace('Passing', 'Pass')
        .replace('Rushing', 'Rush')
        .replace('Receiving', 'Recv')
        .replace('Any Time Touchdown Scorer', 'Anytime TD')
        .replace('To Score 2+ Touchdowns', '2+ TDs')
      const handicap = Math.round(Number(leg.parsedHandicap))

      let name

      if (
        stat_type === 'Moneyline' ||
        stat_type === 'Anytime TD' ||
        stat_type === '2+ TDs'
      ) {
        name = `${leg.selectionName} ${stat_type} [week ${week}]`
      } else if (stat_type === 'Alternate Spread') {
        name = `${leg.selectionName} [week ${week}]`
      } else {
        name = `${player_name} ${handicap}+ ${stat_type} [week ${week}]`
      }

      return {
        ...leg,
        exposure_count,
        open_wagers,
        open_potential_payout,
        max_potential_payout,
        name,
        week,
        exposure_rate: `${((exposure_count / filtered.length) * 100).toFixed(
          2
        )}%`,
        open_potential_roi:
          ((open_potential_payout / wager_summary.total_risk) * 100).toFixed(
            0
          ) + '%',
        max_potential_roi:
          ((max_potential_payout / wager_summary.total_risk) * 100).toFixed(0) +
          '%'
      }
    })
    .sort((a, b) => b.exposure_count - a.exposure_count)

  const props_index = {}
  for (const prop of props) {
    const key = `${prop.eventId}/${prop.marketId}/${prop.selectionId}`
    props_index[key] = prop
  }

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

  const wager_summary_table = new Table({ title: 'Execution Summary' })

  const props_summary = get_props_summary(props)
  props_summary.market_implied_hits = Number(
    props_summary.market_implied_hits.toFixed(2)
  )

  const wager_table_row = {
    current_roi: wager_summary.current_roi,
    open_potential_roi:
      (
        (wager_summary.open_potential_win / wager_summary.total_risk - 1) *
        100
      ).toFixed(0) + '%',
    max_potential_roi:
      (
        (wager_summary.max_potential_win / wager_summary.total_risk - 1) *
        100
      ).toFixed(0) + '%',
    ...props_summary
  }

  if (show_counts) {
    wager_table_row.wagers = wager_summary.wagers
    wager_table_row.total_won = wager_summary.total_won
    // wager_table_row.wagers_won = wager_summary.wagers_won
    // wager_table_row.wagers_loss = wager_summary.wagers_loss
    wager_table_row.wagers_open = wager_summary.wagers_open
    wager_table_row.total_risk_units = wager_summary.total_risk
  }

  if (show_potential_gain) {
    wager_table_row.open_potential_win = wager_summary.open_potential_win
    wager_table_row.max_potential_win = wager_summary.max_potential_win
  }

  wager_summary_table.addRow(wager_table_row)
  wager_summary_table.printTable()

  if (show_counts) {
    // Create table showing full accounting of wagers by number of losing selections
    // Dynamically generates columns for all observed counts (e.g., 1, 2, 3, 4, 5...)
    const lost_by_legs_summary_table = new Table({
      title: 'Wagers Lost By # Selections'
    })

    // Get all unique leg counts and sort them numerically
    const leg_counts = Object.keys(wager_summary.lost_by_legs)
      .map(Number)
      .sort((a, b) => a - b)

    // Build row object dynamically with each count as a column
    const row = {}
    for (const count of leg_counts) {
      row[count] = wager_summary.lost_by_legs[count]
    }

    // Only display table if we have data
    if (Object.keys(row).length > 0) {
      lost_by_legs_summary_table.addRow(row)
    }

    lost_by_legs_summary_table.printTable()
  }

  const unique_props_table = new Table()
  const props_with_exposure = props.map((prop) => {
    const result = {
      name: prop.name,
      odds: prop.americanPrice,
      exposure_rate: prop.exposure_rate,
      result: prop.result,
      max_potential_roi: prop.max_potential_roi,
      open_potential_roi: prop.open_potential_roi
    }

    if (show_potential_gain) {
      result.open_potential_payout = prop.open_potential_payout.toFixed(2)
      result.max_potential_payout = prop.max_potential_payout.toFixed(2)
    }

    if (show_counts) {
      result.exposure_count = prop.exposure_count
    }

    return result
  })

  props_with_exposure.forEach((prop) => unique_props_table.addRow(prop))
  unique_props_table.printTable()

  const grouped_props_by_event = props.reduce((grouped_props, prop) => {
    const event_id = prop.eventId
    if (!grouped_props[event_id]) {
      grouped_props[event_id] = []
    }
    grouped_props[event_id].push(prop)
    return grouped_props
  }, {})

  for (const event_id in grouped_props_by_event) {
    const event_table = new Table({ title: event_index[event_id] })
    grouped_props_by_event[event_id]
      .sort((a, b) => b.exposure_count - a.exposure_count)
      .forEach((prop) => {
        const row = {
          name: prop.name,
          odds: prop.americanPrice,
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
  // const three_props = []

  const lost_props = props.filter((prop) => prop.result === 'LOST')

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
      const row = {
        name: prop.name,
        potential_roi_added: prop.potential_roi_added.toFixed(0) + '%'
      }

      if (show_potential_gain) {
        row.potential_gain = prop.potential_gain.toFixed(2)
      }

      if (show_counts) {
        row.potential_wins = prop.potential_wins
      }

      one_prop_table.addRow(row)
    }
    one_prop_table.printTable()
  }

  if (two_props.length) {
    const two_prop_table = new Table({ title: 'Two Legs Away' })
    for (const prop of two_props.sort(
      (a, b) => b.potential_gain - a.potential_gain
    )) {
      const row = {
        name: prop.name,
        potential_roi_added: prop.potential_roi_added.toFixed(0) + '%'
      }

      if (show_potential_gain) {
        row.potential_gain = prop.potential_gain.toFixed(2)
      }

      if (show_counts) {
        row.potential_wins = prop.potential_wins
      }

      two_prop_table.addRow(row)
    }
    two_prop_table.printTable()
  }

  if (hide_wagers) return

  console.log('\n\nTop 50 slips sorted by highest odds (<= 1 lost legs)\n\n')

  const closest_wagers = filtered.filter(
    (wager) =>
      wager.legs.filter((leg) => leg.result === 'LOST').length <=
      wagers_lost_leg_limit
  )

  const display_wagers = closest_wagers.filter((wager) => {
    // Filter out wagers that include any of the excluded selections
    if (exclude_selections.length > 0) {
      if (
        wager.legs.some((leg) =>
          exclude_selections.some((filter) =>
            leg.parts[0].selectionName
              .toLowerCase()
              .includes(filter.toLowerCase())
          )
        )
      ) {
        return false
      }
    }

    // Filter to only include wagers that have all of the included selections
    if (include_selections.length > 0) {
      return include_selections.every((filter) =>
        wager.legs.some((leg) =>
          leg.parts[0].selectionName
            .toLowerCase()
            .includes(filter.toLowerCase())
        )
      )
    }

    return true
  })

  for (const wager of display_wagers
    .sort((a, b) => b.americanBetPrice - a.americanBetPrice)
    .slice(0, wagers_limit)) {
    const total_return = wager.betPrice
      ? wager.betPrice * wager.currentSize
      : Number(wager.potentialWin)
    const potential_roi_gain = (total_return / wager_summary.total_risk) * 100
    const num_of_legs = wager.legs.length
    let wager_table_title = `[${num_of_legs} leg parlay] American odds: +${
      wager.americanBetPrice || 'N/A'
    } / ${potential_roi_gain.toFixed(2)}% roi`

    if (show_potential_gain) {
      wager_table_title += ` ($${total_return.toFixed(0)})`
    }

    if (show_bet_receipts) {
      const bet_receipt_id = wager.betReceiptId.replace(
        /(\d{4})(\d{4})(\d{4})(\d{4})/,
        '$1-$2-$3-$4'
      )

      wager_table_title += ` / Bet Receipt: ${bet_receipt_id}`
    }

    wager_table_title += ` [Week ${wager.week}]`

    const wager_table = new Table({ title: wager_table_title })
    for (const legs of wager.legs) {
      const prop =
        props_index[
          `${legs.parts[0].eventId}/${legs.parts[0].marketId}/${legs.parts[0].selectionId}`
        ]
      wager_table.addRow({
        selection: prop.name,
        odds: legs.parts[0].americanPrice,
        result: legs.result
      })
    }
    wager_table.printTable()
  }
}

const main = async () => {
  let error
  const argv = initialize_cli()
  console.log(argv.include)
  try {
    await analyze_fanduel_wagers({
      filename: argv.file,
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

export default analyze_fanduel_wagers
