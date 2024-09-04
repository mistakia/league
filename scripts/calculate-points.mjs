import db from '#db'
import { is_main, getLeague } from '#libs-server'
import { constants, groupBy, calculatePoints } from '#libs-shared'
import chalk from 'chalk'
import { Table } from 'console-table-printer'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-points')
debug.enable('calculate-points')

const calculate_points = async ({
  year,
  lid,
  scoring_format_hash,
  week = 'ALL'
}) => {
  if (!Number.isInteger(year)) {
    throw new Error(`${year} invalid year`)
  }

  let league

  if (lid) {
    league = await getLeague(lid)
  } else if (scoring_format_hash) {
    league = await db('league_scoring_formats')
      .where('scoring_format_hash', scoring_format_hash)
      .first()
  }

  if (!league) {
    throw new Error(`${lid} or ${scoring_format_hash} is missing or invalid`)
  }

  log(`calculating Points for ${year}`)

  // get player stats for year
  const query = db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'player.pname',
      'player.pos',
      'player.start',
      'player_gamelogs.pid',
      'nfl_games.week'
    )
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .whereIn('player.pos', constants.positions)
    .join('player', 'player_gamelogs.pid', 'player.pid')

  if (week !== 'ALL') {
    query.where('nfl_games.week', week)
  }

  const rows = await query
  const weeks = [...new Set(rows.map((r) => r.week))]
  const grouped_by_pid = groupBy(rows, 'pid')

  const players = []
  for (const pid of Object.keys(grouped_by_pid)) {
    const item = {}
    const games = grouped_by_pid[pid]
    item.games = games

    item.points = {}

    // set default values
    for (const week of weeks) {
      item.points[week] = { total: 0 }
    }

    // calculate fantasy points
    for (const game of games) {
      const points = calculatePoints({
        stats: game,
        position: game.pos,
        league
      })
      item.points[game.week] = points
    }

    const { pname, pos, start } = games[0]
    players.push({ pid, pname, pos, start, ...item })
  }

  const points_by_position = {}
  for (const pos of constants.positions) {
    points_by_position[pos] = []
  }

  for (const player of players) {
    player.total_points = Object.values(player.points).reduce(
      (sum, p) => sum + p.total,
      0
    )
    points_by_position[player.pos].push(player.total_points)
  }

  for (const pos of constants.positions) {
    points_by_position[pos] = points_by_position[pos].sort((a, b) => b - a)
  }

  log(`calculated Points for ${rows.length} players`)

  const output = {}
  for (const player of players) {
    output[player.pid] = {
      player: player.pname,
      rookie: player.start === year,
      pos_rnk: points_by_position[player.pos].indexOf(player.total_points) + 1,
      pos: player.pos,
      points: player.total_points,
      games: player.games
    }
  }

  return { players: output, weeks: weeks.length }
}

const main = async () => {
  try {
    const result = await calculate_points({
      year: argv.year,
      lid: argv.lid,
      scoring_format_hash: argv.scoring_format_hash,
      week: argv.week
    })

    const top_200 = Object.values(result.players)
      .sort((a, b) => b.points - a.points)
      .slice(0, 200)

    const table = new Table()

    const get_color = (pos) => {
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

    for (const [index, player] of top_200.entries()) {
      table.addRow(
        {
          index: index + 1,
          name: player.player,
          points: player.points.toFixed(2),
          pos: player.pos,
          rookie: player.rookie ? 'rookie' : '',
          games: player.games.length
        },
        {
          color: get_color(player.pos)
        }
      )
    }

    console.log(
      chalk.bold(`${argv.year} Player Points (${result.weeks} weeks)`)
    )
    table.printTable()
  } catch (e) {
    log(e)
  }

  process.exit()
}

// If this script is run directly, execute the main function
if (is_main(import.meta.url)) {
  debug.enable('calculate-points')
  main()
}

export default calculate_points
