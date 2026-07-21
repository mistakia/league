import debug from 'debug'
import chalk from 'chalk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import { is_main } from '#libs-server'
import calculate_points_added from './calculate-points-added.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

// const log = debug('script:calculate-rookie-pick-value')
const LATEST_YEAR = 2020

const calculateRookiePickValue = async ({ year }) => {
  if (year > LATEST_YEAR) {
    throw new Error(`invalid year ${year}`)
  }

  // TODO get rookie position rank
  // get up to 4 seasons of data
  const seasons = {}
  const limit = LATEST_YEAR - year + 1
  for (let i = 1; i <= limit; i++) {
    const { players } = await calculate_points_added({
      year: year + (i - 1),
      rookie: i === 1
    })
    seasons[i] = players
  }

  const result = {}

  const rookieSeason = seasons['1']
  for (const pid in rookieSeason) {
    const playerRookieSeason = rookieSeason[pid]
    const playerResult = {
      pts_added_earned: playerRookieSeason.pts_added_earned,
      pts_added_net: playerRookieSeason.pts_added_net,
      value: playerRookieSeason.value,
      points: playerRookieSeason.points
    }
    for (let i = 2; i <= limit; i++) {
      const playerSeason = seasons[i][pid]
      if (playerSeason) {
        playerResult.pts_added_earned += playerSeason.pts_added_earned
        playerResult.pts_added_net += playerSeason.pts_added_net
        playerResult.value += playerSeason.value
        playerResult.points += playerSeason.points
      }
    }
    result[pid] = {
      ...playerRookieSeason,
      ...playerResult
    }
  }

  return result
}

if (is_main(import.meta.url)) {
  debug.enable('script:calculate-points-added')
  const main = async () => {
    try {
      const argv = initialize_cli()
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
            pid: player.pid,
            pts_added: player.pts_added_earned.toFixed(2),
            points: player.points.toFixed(2),
            position_rank: player.position_rank,
            value: player.value,
            pos: player.primary_position
          },
          {
            color: getColor(player.primary_position)
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
