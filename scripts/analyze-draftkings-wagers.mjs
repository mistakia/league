import debug from 'debug'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import * as oddslib from 'oddslib'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { Table } from 'console-table-printer'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants } from '#libs-shared'
import { is_main } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('analyze-draftkings-wagers')
debug.enable('analyze-draftkings-wagers')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const format_prop_name = (prop) => {
  if (prop.nestedSGPSelections) {
    const names = []
    for (const nested_prop of prop.nestedSGPSelections) {
      names.push(format_prop_name(nested_prop))
    }

    return names.join(' / ')
  }

  const player_name = prop.marketDisplayName.split(' Alternate ')[0]
  const prop_type = prop.marketDisplayName.split(' Alternate ')[1]
  return `${player_name} ${prop.selectionDisplayName} ${prop_type}`
}

const is_prop_equal = (prop_a, prop_b) =>
  prop_a.eventId === prop_b.eventId &&
  prop_a.marketId === prop_b.marketId &&
  prop_a.selectionId === prop_b.selectionId

const get_props_summary = (props) =>
  props.reduce(
    (accumulator, prop) => {
      const odds = oddslib.from('moneyline', prop.parsed_odds)
      const is_win = prop.settlementStatus === 'Won'
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
      const lost_legs = wager.selections.filter((selection) => {
        for (const prop of props) {
          if (is_prop_equal(selection, prop)) {
            return false
          }
        }
        return selection.settlementStatus === 'Lost'
      }).length

      const is_settled = wager.status === 'Settled'

      const is_won = is_settled && lost_legs === 0
      const is_lost = is_settled && lost_legs > 0

      return {
        wagers: accumulator.wagers + 1,
        wagers_won: is_won
          ? accumulator.wagers_won + 1
          : accumulator.wagers_won,
        wagers_loss: is_lost
          ? accumulator.wagers_loss + 1
          : accumulator.wagers_loss,

        total_risk: accumulator.total_risk + wager.stake,
        total_won: is_won
          ? accumulator.total_won + wager.potentialReturns
          : accumulator.total_won,
        total_potential_win:
          accumulator.total_potential_win + wager.potentialReturns,

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
      wagers: 0,
      wagers_won: 0,
      wagers_loss: 0,
      total_risk: 0,
      total_won: 0,
      total_potential_win: 0,
      lost_by_one_leg: 0,
      lost_by_two_legs: 0,
      lost_by_three_legs: 0,
      lost_by_four_or_more_legs: 0
    }
  )

const analyze_draftkings_wagers = async ({
  filename,
  week,
  show_counts = false,
  show_potential_gain = false,
  hide_wagers = false
} = {}) => {
  if (!filename) {
    throw new Error('filename is required')
  }

  const json_file_path = `${data_path}/${filename}`
  log(`loading wagers from ${json_file_path}`)
  const wagers = await fs.readJson(json_file_path)

  for (const wager of wagers) {
    wager.week = dayjs(wager.settlementDate)
      .subtract('2', 'day')
      .diff(constants.season.regular_season_start, 'weeks')
  }

  const filtered = wagers.filter((wager) => {
    // if (wager.type === 'RoundRobin') {
    //   return false
    // }

    // filter out wagers that do not have multiple selections
    // if (wager.selections.length < 2) {
    //   return false
    // }

    if (week) {
      return wager.week === week
    }

    return true
  })

  for (const wager of filtered) {
    wager.parsed_odds = Number(wager.displayOdds.replace(/—|-|−/g, '-'))
  }

  const wager_summary = get_wagers_summary({ wagers: filtered })
  wager_summary.roi = `${
    (wager_summary.total_won / wager_summary.total_risk - 1) * 100
  }%`
  wager_summary.total_risk = Number(wager_summary.total_risk.toFixed(2))
  wager_summary.total_potential_win = Number(
    wager_summary.total_potential_win.toFixed(2)
  )

  const wager_summary_table = new Table({ title: 'Wagers Summary' })
  wager_summary_table.addRow({
    wagers: wager_summary.wagers,
    wagers_won: wager_summary.wagers_won,
    wagers_loss: wager_summary.wagers_loss,
    total_risk: wager_summary.total_risk,
    total_won: wager_summary.total_won,
    total_potential_win: wager_summary.total_potential_win,
    roi: wager_summary.roi
  })
  wager_summary_table.printTable()

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

  const wager_selections = filtered
    .map((wager) => {
      return wager.selections.map((selection) => {
        return { ...selection, week: wager.week }
      })
    })
    .flat()
  const wager_index = {}

  const props = wager_selections.filter((selection) => {
    const key = `${selection.eventId}/${selection.marketId}/${selection.selectionId}`
    if (wager_index[key]) {
      return false
    }

    wager_index[key] = true

    return true
  })

  const filtered_props_key = {}
  const filtered_props = props
    .filter((p) => {
      // TODO confirm this is correct
      if (p.settlementStatus === 'Void') {
        return false
      }

      if (!p.displayOdds) {
        return false
      }

      const key = `${p.marketId}_${p.selectionId}`
      if (filtered_props_key[key]) {
        return false
      }

      filtered_props_key[key] = true
      return true
    })
    .map((prop) => ({
      ...prop,
      parsed_odds: Number(prop.displayOdds.replace(/—|-|−/g, '-'))
    }))
    .sort((a, b) => b.parsed_odds - a.parsed_odds)

  const unique_props_table = new Table()
  const props_with_exposure = filtered_props.map((prop) => {
    let potential_payout = 0
    let exposure_count = 0

    for (const wager of filtered) {
      for (const selection of wager.selections) {
        if (is_prop_equal(prop, selection)) {
          potential_payout += wager.potentialReturns
          exposure_count += 1

          break
        }
      }
    }

    return {
      name: format_prop_name(prop),
      odds: prop.displayOdds,
      exposure_count,
      exposure_rate: `${((exposure_count / filtered.length) * 100).toFixed(
        2
      )}%`,
      potential_payout: potential_payout.toFixed(2),
      result: prop.settlementStatus
    }
  })

  props_with_exposure.sort((a, b) => b.exposure_count - a.exposure_count)
  props_with_exposure.forEach(
    ({ exposure_count, potential_payout, ...prop }) => {
      if (show_counts) {
        prop.exposure_count = exposure_count
      }

      if (show_potential_gain) {
        prop.potential_payout = potential_payout
      }

      unique_props_table.addRow(prop)
    }
  )
  unique_props_table.printTable()

  const props_summary = get_props_summary(filtered_props)
  props_summary.market_implied_hits = Number(
    props_summary.market_implied_hits.toFixed(2)
  )
  const props_summary_table = new Table()
  props_summary_table.addRow(props_summary)
  props_summary_table.printTable()

  const one_prop = []
  const two_props = []

  const lost_props = props.filter((prop) => prop.settlementStatus === 'Lost')

  for (let i = 0; i < lost_props.length; i++) {
    const prop_a = lost_props[i]

    const one_prop_summary = get_wagers_summary({
      wagers: filtered,
      props: [prop_a]
    })
    const potential_gain = one_prop_summary.total_won - wager_summary.total_won
    const potential_wins =
      one_prop_summary.wagers_won - wager_summary.wagers_won

    if (potential_gain) {
      const prop_name = format_prop_name(prop_a)
      one_prop.push({
        name: `${prop_name} (week ${prop_a.week})`,
        potential_gain,
        potential_wins
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

      if (potential_gain) {
        two_props.push({
          name: `${format_prop_name(prop_a)} / ${format_prop_name(
            prop_b
          )} (week ${prop_a.week})`,
          potential_gain,
          potential_wins
        })
      }
    }
  }

  if (one_prop.length) {
    const one_prop_table = new Table({ title: 'One Leg Away' })
    for (const prop of one_prop
      .sort((a, b) => b.potential_gain - a.potential_gain)
      .slice(0, 50)) {
      const potential_roi_added =
        (prop.potential_gain / wager_summary.total_risk) * 100
      one_prop_table.addRow({
        name: prop.name,
        potential_gain: prop.potential_gain.toFixed(2),
        potential_wins: prop.potential_wins,
        potential_roi_added: potential_roi_added.toFixed(2) + '%'
      })
    }
    one_prop_table.printTable()
  }

  if (two_props.length) {
    const two_prop_table = new Table({ title: 'Two Legs Away' })
    for (const prop of two_props
      .sort((a, b) => b.potential_gain - a.potential_gain)
      .slice(0, 50)) {
      const potential_roi_added =
        (prop.potential_gain / wager_summary.total_risk) * 100
      two_prop_table.addRow({
        name: prop.name,
        potential_gain: prop.potential_gain.toFixed(2),
        potential_wins: prop.potential_wins,
        potential_roi_added: potential_roi_added.toFixed(2) + '%'
      })
    }
    two_prop_table.printTable()
  }

  if (hide_wagers) {
    return
  }

  console.log('\n\nTop 50 slips sorted by highest odds (<= 2 lost legs)\n\n')

  const closest_wagers = filtered.filter(
    (wager) =>
      wager.selections.filter((leg) => leg.settlementStatus === 'Lost')
        .length <= 2
  )
  for (const wager of closest_wagers
    .sort((a, b) => b.parsed_odds - a.parsed_odds)
    .slice(0, 50)) {
    const total_return = wager.potentialReturns
    const potential_roi_gain = (total_return / wager_summary.total_risk) * 100
    const wager_table = new Table({
      title: `Week: ${wager.week}, Wager ID: ${wager.betId}, Bet Receipt ID: ${
        wager.receiptId
      }, Number of Legs: ${wager.selections.length}, American Odds: ${
        wager.displayOdds
      }, Potential ROI Gain: +${potential_roi_gain.toFixed(
        2
      )}%, Potential Gain: ${total_return}`
    })
    for (const selection of wager.selections) {
      wager_table.addRow({
        name: format_prop_name(selection),
        odds: selection.displayOdds,
        status: selection.settlementStatus
      })
    }
    wager_table.printTable()
  }
}

const main = async () => {
  let error
  try {
    const filename = argv.filename
    const week = argv.week ? Number(argv.week) : null

    await analyze_draftkings_wagers({
      filename,
      week,
      hide_wagers: argv.hide_wagers
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

export default analyze_draftkings_wagers
