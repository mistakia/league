import regression from 'regression'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'
import { ckmeans, mean } from 'simple-statistics'
import debug from 'debug'

import {
  groupBy,
  constants,
  getPlayerCountBySlot,
  getEligibleSlots
} from '#libs-shared'
import { getLeague, isMain } from '#libs-server'
import db from '#db'
import calculate_points_added from './calculate-points-added.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-points-added-baseline-season')
debug.enable('calculate-points-added-baseline-season,calculate-points-added')

function removeOutliers(arr) {
  // Sort the array in ascending order
  const sortedArr = arr.slice().sort((a, b) => a - b)

  // Calculate the interquartile range (IQR)
  const q1 = Math.floor(sortedArr.length * 0.25)
  const q3 = Math.floor(sortedArr.length * 0.75)
  const iqr = sortedArr[q3] - sortedArr[q1]

  // Define the lower and upper bounds
  const lowerBound = sortedArr[q1] - 1.5 * iqr
  const upperBound = sortedArr[q3] + 1.5 * iqr

  // Filter out the outliers
  const filteredArr = arr.filter(
    (num) => num >= lowerBound && num <= upperBound
  )

  return filteredArr
}

const calculate_points_added_baseline_season = async ({ league }) => {
  const years = 2
  let year = constants.season.year - years

  const data = {}

  for (; year < constants.season.year; year++) {
    const { players } = await calculate_points_added({ year, league })
    const values = Object.values(players)
    const byPosition = groupBy(values, 'pos')
    for (const pos in byPosition) {
      if (data[pos]) {
        data[pos][year] = byPosition[pos]
      } else {
        data[pos] = {
          [year]: byPosition[pos]
        }
      }
    }
  }

  let output = []
  for (const pos in data) {
    const byPosition = data[pos]
    const sums = {}
    for (const year in byPosition) {
      const players = byPosition[year]
      const sorted = players.sort((a, b) => b.pts_added - a.pts_added)
      for (const [index, player] of sorted.entries()) {
        if (sums[index]) {
          sums[index].pts_added += player.pts_added
          sums[index].value += player.value
          sums[index].points += player.points
        } else {
          sums[index] = {
            pos,
            rank: index + 1,
            pts_added: player.pts_added,
            value: player.value,
            points: player.points
          }
        }
      }
    }

    for (const prnk in sums) {
      const item = sums[prnk]
      item.value = item.value / years
      item.pts_added = item.pts_added / years
      item.points = item.points / years
    }

    /* const pts_added_values = Object.values(sums).map(v => [v.rank, v.pts_added || 0.01])
     * const pts_added_regression = pos === 'QB' ? regression.linear(pts_added_values) : regression.exponential(pts_added_values)
     * const values = Object.values(sums).map(v => ({ reg: pts_added_regression.predict(v.rank)[1], ...v }))
     */
    const regValues = Object.values(sums).map((v) => [v.rank, v.value || 0.01])
    const regV =
      pos === 'QB'
        ? regression.linear(regValues)
        : regression.logarithmic(regValues)
    const regPoints = Object.values(sums).map((v) => [v.rank, v.points || 0.01])
    const regP =
      pos === 'QB'
        ? regression.linear(regPoints)
        : regression.logarithmic(regPoints)
    const values = Object.values(sums).map((v) => ({
      regV: regV.predict(v.rank)[1],
      regP: regP.predict(v.rank)[1],
      ...v
    }))

    output = output.concat(values)
  }

  return output.sort((a, b) => b.pts_added - a.pts_added)
}

if (isMain(import.meta.url)) {
  const main = async () => {
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }

    const league = await getLeague({ lid })
    const result = await calculate_points_added_baseline_season({ league })
    const baselines = {}
    for (const pos of constants.positions) {
      baselines[pos] = {}
    }

    const p = new Table()
    const getColor = (pos) => {
      switch (pos) {
        case 'QB':
          return 'red'
        case 'RB':
          return 'green'
        case 'WR':
          return 'white'
        case 'TE':
          return 'cyan'
      }
    }

    for (const player of result) {
      if (player.pts_added > 0) {
        baselines[player.pos] = player
      }

      p.addRow(
        {
          position: `${player.pos}${player.rank}`,
          value: player.pts_added.toFixed(1),
          reg_value: player.regV,
          reg_points: player.regP,
          salary: player.value.toFixed(2),
          points: player.points.toFixed(1)
        },
        {
          color: getColor(player.pos)
        }
      )
    }

    if (argv.display) {
      p.printTable()
    }

    if (argv.save) {
      // create a pool of starters based on league format
      const starters_pool = {}
      const playerCountBySlot = getPlayerCountBySlot({ league })
      for (const slot in playerCountBySlot) {
        starters_pool[slot] = []
      }

      for (const player of result) {
        const eligibleSlots = getEligibleSlots({ pos: player.pos, league })
        for (const slot of eligibleSlots) {
          if (starters_pool[slot].length < playerCountBySlot[slot]) {
            starters_pool[slot].push(player)
            break
          }
        }
      }

      // organize starters by position
      const starters_pool_by_pos = {}
      for (const slot in starters_pool) {
        const players = starters_pool[slot]
        for (const player of players) {
          if (!starters_pool_by_pos[player.pos]) {
            starters_pool_by_pos[player.pos] = []
          }
          starters_pool_by_pos[player.pos].push(player)
        }
      }

      const update = {}
      for (const pos of constants.positions) {
        const pos_starters = starters_pool_by_pos[pos] || []
        const pos_starters_baselines = pos_starters
          .map((p) => p.points - p.pts_added)
          .sort((a, b) => b - a)

        if (pos === 'K' || pos === 'DST') {
          const top_week =
            pos_starters_baselines[0] / (constants.season.nflFinalWeek - 1)

          update[`pts_base_season_${pos.toLowerCase()}`] = top_week || null
          continue
        }

        const filtered_starter_baselines = removeOutliers(
          pos_starters_baselines.slice(0, 9)
        )

        if (pos === 'TE') {
          const top_week =
            filtered_starter_baselines[0] / (constants.season.nflFinalWeek - 1)

          update[`pts_base_season_${pos.toLowerCase()}`] = top_week || null
          continue
        }

        const filtered_breaks = ckmeans(filtered_starter_baselines, 3)
        const filtered_breaks_sorted = filtered_breaks.sort(
          (a, b) => b.length - a.length
        )

        // get largest break, join with any other equal length breaks
        const filtered_break = filtered_breaks_sorted[0]
        const filtered_breaks_equal = filtered_breaks_sorted.filter(
          (b) => b.length === filtered_break.length
        )
        const filtered_break_joined = filtered_breaks_equal.reduce(
          (a, b) => a.concat(b),
          []
        )

        const filtered_break_mean = mean(filtered_break_joined)
        const filtered_break_mean_week =
          filtered_break_mean / (constants.season.nflFinalWeek - 1)

        update[`pts_base_season_${pos.toLowerCase()}`] =
          filtered_break_mean_week || null
      }

      log(update)
      await db('league_formats')
        .update(update)
        .where({ league_format_hash: league.league_format_hash })
    }

    process.exit()
  }

  main()
}
