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
import { constants } from '#common'
import { isMain } from '#utils'

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
        expected_hits:
          accumulator.expected_hits + odds.to('impliedProbability'),
        actual_hits: is_win
          ? accumulator.actual_hits + 1
          : accumulator.actual_hits,
        total_props: accumulator.total_props + 1
      }
    },
    {
      expected_hits: 0,
      actual_hits: 0,
      total_props: 0
    }
  )

const format_wagers_summary = (summary) => ({
  ...summary,
  roi: (summary.total_won / summary.total_risk - 1) * 100
})

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

      const total_return = wager.betPrice * wager.currentSize
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
          ? accumulator.total_won + (props.length ? total_return : wager.pandl)
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

const analyze_fanduel_wagers = async ({
  filename = 'fanduel_wagers.json',
  week = constants.season.week
} = {}) => {
  const json_file_path = `${data_path}/${filename}`
  log(`loading wagers from ${json_file_path}`)
  const wagers = await fs.readJson(json_file_path)

  const filtered = wagers.filter((wager) => {
    if (wager.legs.length < 2) {
      return false
    }

    const wager_week = dayjs(wager.settledDate)
      .subtract('2', 'day')
      .diff(constants.season.start, 'weeks')
    return wager_week === week
  })

  const wager_summary = get_wagers_summary({ wagers: filtered })
  log(format_wagers_summary(wager_summary))

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
    // .filter((p) => p.americanPrice >= 200)
    .sort((a, b) => b.americanPrice - a.americanPrice)
    .filter((p) => {
      if (filtered_props_key[p.selectionName]) {
        return false
      }
      filtered_props_key[p.selectionName] = true
      return true
    })
  // log(filtered_props)
  log(get_props_summary(filtered_props))

  const one_prop = []
  const two_props = []
  const three_props = []

  const lost_props = props.filter((prop) => prop.result === 'LOST')

  const exclude_props = []

  for (let i = 0; i < lost_props.length; i++) {
    const prop_a = lost_props[i]

    if (exclude_props.includes(prop_a.selectionName)) continue

    const one_prop_summary = get_wagers_summary({
      wagers: filtered,
      props: [prop_a]
    })
    const gain = one_prop_summary.total_won - wager_summary.total_won
    const wins = one_prop_summary.wagers_won - wager_summary.wagers_won

    if (gain) {
      one_prop.push({
        name: prop_a.selectionName,
        gain,
        wins
      })
    }

    for (let j = i + 1; j < lost_props.length; j++) {
      const prop_b = lost_props[j]

      if (exclude_props.includes(prop_b.selectionName)) continue

      const two_prop_summary = get_wagers_summary({
        wagers: filtered,
        props: [prop_a, prop_b]
      })
      const gain = two_prop_summary.total_won - wager_summary.total_won
      const wins = two_prop_summary.wagers_won - wager_summary.wagers_won

      if (gain) {
        two_props.push({
          name: `${prop_a.selectionName} / ${prop_b.selectionName}`,
          gain,
          wins
        })
      }

      for (let k = j + 1; k < lost_props.length; k++) {
        const prop_c = lost_props[k]

        if (exclude_props.includes(prop_c.selectionName)) continue

        const three_prop_summary = get_wagers_summary({
          wagers: filtered,
          props: [prop_a, prop_b, prop_c]
        })
        const gain = three_prop_summary.total_won - wager_summary.total_won
        const wins = three_prop_summary.wagers_won - wager_summary.wagers_won

        if (gain) {
          three_props.push({
            name: `${prop_a.selectionName} / ${prop_b.selectionName} / ${prop_c.selectionName}`,
            gain,
            wins
          })
        }
      }
    }
  }

  log('One Leg Away')
  const one_prop_table = new Table()
  for (const prop of one_prop.sort((a, b) => b.gain - a.gain)) {
    one_prop_table.addRow({
      name: prop.name,
      gain: prop.gain.toFixed(2),
      wins: prop.wins
    })
  }
  one_prop_table.printTable()

  log('Two Legs Away')
  const two_prop_table = new Table()
  for (const prop of two_props.sort((a, b) => b.gain - a.gain)) {
    two_prop_table.addRow({
      name: prop.name,
      gain: prop.gain.toFixed(2),
      wins: prop.wins
    })
  }
  // two_prop_table.printTable()

  log('Three Legs Away')
  const three_prop_table = new Table()
  for (const prop of three_props
    .sort((a, b) => b.gain - a.gain)
    .splice(0, 100)) {
    three_prop_table.addRow({
      name: prop.name,
      gain: prop.gain.toFixed(2),
      wins: prop.wins
    })
  }
  // three_prop_table.printTable()
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
