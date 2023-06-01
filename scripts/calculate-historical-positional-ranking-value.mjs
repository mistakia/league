import regression from 'regression'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import { groupBy, constants } from '#common'
import { getLeague, isMain } from '#utils'
import calculate_points_added from './calculate-points-added.mjs'

const argv = yargs(hideBin(process.argv)).argv

const calculateHistoricalPositionalRankingValue = async ({ league }) => {
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
      for (const player of players) {
        if (sums[player.prnk]) {
          sums[player.prnk].pts_added += player.pts_added
          sums[player.prnk].value += player.value
          sums[player.prnk].points += player.points
        } else {
          sums[player.prnk] = {
            pos,
            rank: player.prnk,
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
    }

    /* const pts_added_values = Object.values(sums).map(v => [v.rank, v.pts_added || 0.01])
     * const pts_added_regression = pos === 'QB' ? regression.linear(pts_added_values) : regression.exponential(pts_added_values)
     * const values = Object.values(sums).map(v => ({ reg: pts_added_regression.predict(v.rank)[1], ...v }))
     */
    const regValues = Object.values(sums).map((v) => [v.rank, v.value || 0.01])
    const reg =
      pos === 'QB'
        ? regression.linear(regValues)
        : regression.exponential(regValues)
    const values = Object.values(sums).map((v) => ({
      reg: reg.predict(v.rank)[1],
      ...v
    }))

    output = output.concat(values)
  }

  return output.sort((a, b) => b.reg - a.reg)
}

if (isMain(import.meta.url)) {
  const main = async () => {
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }

    const league = await getLeague({ lid })
    const result = await calculateHistoricalPositionalRankingValue({ league })

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
      p.addRow(
        {
          position: `${player.pos}${player.rank}`,
          pts_added: player.pts_added.toFixed(1),
          value: player.reg,
          actual: player.value.toFixed(2)
        },
        {
          color: getColor(player.pos)
        }
      )
    }

    p.printTable()
    process.exit()
  }

  main()
}
