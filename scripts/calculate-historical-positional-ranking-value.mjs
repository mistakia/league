import regression from 'regression'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import { groupBy } from '#libs-shared'
import { current_season } from '#constants'
import { getLeague, is_main } from '#libs-server'
import calculate_points_added from './calculate-points-added.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const calculateHistoricalPositionalRankingValue = async ({ league }) => {
  const years = 2
  let year = current_season.year - years

  const data = {}

  for (; year < current_season.year; year++) {
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
        if (sums[player.pos_rnk]) {
          sums[player.pos_rnk].pts_added += player.pts_added
          sums[player.pos_rnk].value += player.value
          sums[player.pos_rnk].points += player.points
        } else {
          sums[player.pos_rnk] = {
            pos,
            rank: player.pos_rnk,
            pts_added: player.pts_added,
            value: player.value,
            points: player.points
          }
        }
      }
    }

    for (const pos_rnk in sums) {
      const item = sums[pos_rnk]
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

  return output.sort((a, b) => b.value - a.value)
}

if (is_main(import.meta.url)) {
  const main = async () => {
    const argv = initialize_cli()
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
          regression: player.reg,
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
