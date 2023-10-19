import debug from 'debug'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import * as oddslib from 'oddslib'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { Table } from 'console-table-printer'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

// import db from '#db'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('analyze-fanduel-wagers')
debug.enable('analyze-fanduel-wagers')

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
        total_props: accumulator.total_props + 1,
        expected_hits:
          accumulator.expected_hits + odds.to('impliedProbability'),
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
      const is_won = lost_legs === 0

      return {
        wagers: accumulator.wagers + 1,
        wagers_won: is_won
          ? accumulator.wagers_won + 1
          : accumulator.wagers_won,
        wagers_loss: is_won
          ? accumulator.wagers_loss
          : accumulator.wagers_loss + 1,

        total_risk: accumulator.total_risk + wager.currentSize,
        total_won: is_won
          ? accumulator.total_won + (wager.pandl || total_return)
          : accumulator.total_won,
        total_potential_win: accumulator.total_potential_win + total_return,

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

const analyze_fanduel_wagers = async ({ filename, week } = {}) => {
  if (!filename) {
    throw new Error('filename is required')
  }

  const json_file_path = `${data_path}/${filename}`
  log(`loading wagers from ${json_file_path}`)
  const wagers = await fs.readJson(json_file_path)

  for (const wager of wagers) {
    wager.week = dayjs(wager.settledDate)
      .subtract('2', 'day')
      .diff(constants.season.start, 'weeks')
  }

  const filtered = wagers.filter((wager) => {
    // filter out wagers that do not have multiple legs
    if (wager.legs.length < 2) {
      return false
    }

    if (week) {
      return wager.week === week
    }

    return true
  })

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

  const wager_legs = filtered.map((wager) => wager.legs).flat()
  const wager_parts = wager_legs.map((legs) => legs.parts).flat()
  const wager_index = {}

  const props = wager_parts.filter((leg) => {
    const key = `${leg.eventId}/${leg.marketId}/${leg.selectionId}`
    if (wager_index[key]) {
      return false
    }

    wager_index[key] = true

    return true
  })

  /* const props_hit_table = new Table()
   * for (const prop of props
   *   .filter((p) => p.result === 'WON')
   *   .sort((a, b) => b.americanPrice - a.americanPrice)) {
   *   log(prop)
   * }

   * const props_miss_table = new Table()
   * for (const prop of props
   *   .filter((p) => p.result === 'LOST')
   *   .sort((a, b) => b.americanPrice - a.americanPrice)) {
   *   log(prop)
   * }
   */

  const filtered_props_key = {}
  const filtered_props = props
    .filter((p) => p.result !== 'VOID')
    .sort((a, b) => b.americanPrice - a.americanPrice)
    .filter((p) => {
      const key = `${p.marketId}_${p.selectionId}`
      if (filtered_props_key[key]) {
        return false
      }
      filtered_props_key[key] = true
      return true
    })

  const props_summary = get_props_summary(filtered_props)
  props_summary.expected_hits = Number(props_summary.expected_hits.toFixed(2))
  const props_summary_table = new Table()
  props_summary_table.addRow(props_summary)
  props_summary_table.printTable()

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

    if (potential_gain) {
      const week = dayjs(prop_a.startTime)
        .subtract('2', 'day')
        .diff(constants.season.start, 'weeks')
      one_prop.push({
        name: `${prop_a.selectionName} (week ${week})`,
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
        const week = dayjs(prop_a.startTime)
          .subtract('2', 'day')
          .diff(constants.season.start, 'weeks')

        two_props.push({
          name: `${prop_a.selectionName} / ${prop_b.selectionName} (week ${week})`,
          potential_gain,
          potential_wins
        })
      }

      // for (let k = j + 1; k < lost_props.length; k++) {
      //   const prop_c = lost_props[k]

      //   if (exclude_props.includes(prop_c.selectionName)) continue

      //   const three_prop_summary = get_wagers_summary({
      //     wagers: filtered,
      //     props: [prop_a, prop_b, prop_c]
      //   })
      //   const potential_gain = three_prop_summary.total_won - wager_summary.total_won
      //   const potential_wins = three_prop_summary.wagers_won - wager_summary.wagers_won

      //   if (potential_gain) {
      //     three_props.push({
      //       name: `${prop_a.selectionName} / ${prop_b.selectionName} / ${prop_c.selectionName}`,
      //       potential_gain,
      //       potential_wins
      //     })
      //   }
      // }
    }
  }

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

  console.log('Top 50 closest slips to win with highest odds')
  const closest_wagers = filtered.filter(
    (wager) => wager.legs.filter((leg) => leg.result === 'LOST').length <= 2
  )
  for (const wager of closest_wagers
    .sort((a, b) => b.americanBetPrice - a.americanBetPrice)
    .slice(0, 50)) {
    const total_return = wager.betPrice
      ? wager.betPrice * wager.currentSize
      : Number(wager.potentialWin)
    const potential_roi_gain = (total_return / wager_summary.total_risk) * 100
    const bet_receipt_id = wager.betReceiptId.replace(
      /(\d{4})(\d{4})(\d{4})(\d{4})/,
      '$1-$2-$3-$4'
    )
    const wager_table = new Table({
      title: `Week: ${wager.week}, Wager ID: ${
        wager.betId
      }, Bet Receipt ID: ${bet_receipt_id}, Number of Legs: ${
        wager.legs.length
      }, American Odds: +${
        wager.americanBetPrice
      }, Potential ROI Gain: +${potential_roi_gain.toFixed(
        2
      )}%, Potential Gain: ${total_return}`
    })
    for (const legs of wager.legs) {
      wager_table.addRow({
        selection: legs.parts[0].selectionName,
        odds: legs.parts[0].americanPrice,
        result: legs.result
      })
    }
    wager_table.printTable()
  }
}

const main = async () => {
  let error
  try {
    await analyze_fanduel_wagers({ filename: argv.file, week: argv.week })
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default analyze_fanduel_wagers
