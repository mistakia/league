// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const regression = require('regression')
const { Table } = require('console-table-printer')

const { groupBy } = require('../common')
const calculateVOR = require('./calculate-vor')

const LATEST_YEAR = 2020

const calculateHistoricalPositionalValue = async () => {
  const years = 3
  let year = LATEST_YEAR - years

  const data = {}

  for (; year < LATEST_YEAR; year++) {
    const res = await calculateVOR({ year })
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

  return output.sort((a, b) => b.vor - a.vor)
}

if (!module.parent) {
  const main = async () => {
    const result = await calculateHistoricalPositionalValue()

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
          value: player.vor.toFixed(1),
          regression: player.reg,
          salary: player.value.toFixed(2),
          points: player.points.toFixed(1)
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
