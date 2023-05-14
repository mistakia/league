import regression from 'regression'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'
import debug from 'debug'

import { groupBy, constants } from '#common'
import { getLeague, isMain } from '#utils'
// import db from '#db'
import calculateVOR from './calculate-vor.mjs'

const argv = yargs(hideBin(process.argv)).argv
// const log = debug('calculate-historical-positional-value')
debug.enable('calculate-historical-positional-value,calculate-vor')

const calculateHistoricalPositionalValue = async ({ league }) => {
  const years = 2
  let year = constants.season.year - years

  const data = {}

  for (; year < constants.season.year; year++) {
    const { players } = await calculateVOR({ year, league })
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
      const sorted = players.sort((a, b) => b.vor - a.vor)
      for (const [index, player] of sorted.entries()) {
        if (sums[index]) {
          sums[index].vor += player.vor
          sums[index].value += player.value
          sums[index].points += player.points
        } else {
          sums[index] = {
            pos,
            rank: index + 1,
            vor: player.vor,
            value: player.value,
            points: player.points
          }
        }
      }
    }

    for (const prnk in sums) {
      const item = sums[prnk]
      item.value = item.value / years
      item.vor = item.vor / years
      item.points = item.points / years
    }

    /* const vorValues = Object.values(sums).map(v => [v.rank, v.vor || 0.01])
     * const vorReg = pos === 'QB' ? regression.linear(vorValues) : regression.exponential(vorValues)
     * const values = Object.values(sums).map(v => ({ reg: vorReg.predict(v.rank)[1], ...v }))
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

  return output.sort((a, b) => b.vor - a.vor)
}

if (isMain(import.meta.url)) {
  const main = async () => {
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }

    const league = await getLeague({ lid })
    const result = await calculateHistoricalPositionalValue({ league })
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
      if (player.vor > 0) {
        baselines[player.pos] = player
      }

      p.addRow(
        {
          position: `${player.pos}${player.rank}`,
          value: player.vor.toFixed(1),
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

    // TODO not used - needs updating
    // if (argv.save) {
    //   const playerCountBySlot = getPlayerCountBySlot({ league })
    //   const update = {}
    //   for (const pos of constants.positions) {
    //     if (baselines[pos].rank) {
    //       const min = playerCountBySlot[pos]
    //       update[`b_${pos.toLowerCase()}`] = Math.max(baselines[pos].rank, min)
    //     }
    //   }

    //   log(update)
    //   // await db('leagues').update(update).where({ uid: lid })
    // }

    process.exit()
  }

  main()
}
