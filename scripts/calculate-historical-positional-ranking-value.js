// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const regression = require('regression')
const argv = require('yargs').argv
const { Table } = require('console-table-printer')

const { groupBy } = require('../common')
const { getLeague } = require('../utils')
const calculateVOR = require('./calculate-vor')

const LATEST_YEAR = 2020

const calculateHistoricalPositionalRankingValue = async ({ league }) => {
  const years = 3
  let year = LATEST_YEAR - years

  const data = {}

  for (; year < LATEST_YEAR; year++) {
    const res = await calculateVOR({ year, league })
    const values = Object.values(res)
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
          sums[player.prnk].vor += player.vor
          sums[player.prnk].value += player.value
          sums[player.prnk].points += player.points
        } else {
          sums[player.prnk] = {
            pos,
            rank: player.prnk,
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
    }

    /* const vorValues = Object.values(sums).map(v => [v.rank, v.vor || 0.01])
     * const vorReg = pos === 'QB' ? regression.linear(vorValues) : regression.exponential(vorValues)
     * const values = Object.values(sums).map(v => ({ reg: vorReg.predict(v.rank)[1], ...v }))
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

if (!module.parent) {
  const main = async () => {
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }

    const league = await getLeague(lid)
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
          vor: player.vor.toFixed(1),
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
