// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const debug = require('debug')
const chalk = require('chalk')
const argv = require('yargs').argv

const { Table } = require('console-table-printer')

const calculateVOR = require('./calculate-vor')

// const log = debug('script:calculate-rookie-pick-value')
const LATEST_YEAR = 2019

const calculateRookiePickValue = async ({ year }) => {
  if (year > LATEST_YEAR) {
    throw new Error(`invalid year ${year}`)
  }

  // TODO get rookie position rank
  // get up to 4 seasons of data
  const seasons = {}
  const limit = LATEST_YEAR - year + 1
  for (let i = 1; i <= limit; i++) {
    seasons[i] = await calculateVOR({ year: year + (i - 1), rookie: i === 1 })
  }

  const result = {}

  const rookieSeason = seasons['1']
  for (const playerId in rookieSeason) {
    const playerRookieSeason = rookieSeason[playerId]
    const playerResult = {
      vor: playerRookieSeason.vor,
      value: playerRookieSeason.value,
      points: playerRookieSeason.points
    }
    for (let i = 2; i <= limit; i++) {
      const playerSeason = seasons[i][playerId]
      if (playerSeason) {
        playerResult.vor += playerSeason.vor
        playerResult.value += playerSeason.value
        playerResult.points += playerSeason.points
      }
    }
    result[playerId] = {
      ...playerRookieSeason,
      ...playerResult
    }
  }

  return result
}

if (!module.parent) {
  debug.enable('script:calculate-vor')
  const main = async () => {
    try {
      const year = argv.year
      const results = await calculateRookiePickValue({ year })
      const sortedResults = Object.values(results).sort(
        (a, b) => b.value - a.value
      )
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
      for (const [index, player] of sortedResults.entries()) {
        p.addRow(
          {
            index: index + 1,
            player: player.player,
            vor: player.vor.toFixed(2),
            points: player.points.toFixed(2),
            posrank: player.posrank,
            value: player.value,
            pos: player.pos
          },
          {
            color: getColor(player.pos)
          }
        )
      }
      console.log(chalk.bold(`Year-over-year Rookie Value starting in ${year}`))
      p.printTable()
    } catch (e) {
      console.log(e)
    }

    process.exit()
  }

  main()
}
