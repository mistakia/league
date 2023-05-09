import debug from 'debug'
import chalk from 'chalk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import db from '#db'
import { isMain, getLeague } from '#utils'
import {
  sum,
  constants,
  groupBy,
  getRosterSize,
  calculatePoints,
  calculateValues,
  calculatePrices,
  calculateBaselines
} from '#common'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-vor')
debug.enable('calculate-vor')

const calculateVOR = async ({ year, rookie, league, week = 'ALL' }) => {
  if (!Number.isInteger(year)) {
    throw new Error(`${year} invalid year`)
  }

  const { num_teams, cap, min_bid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = num_teams * cap - num_teams * rosterSize * min_bid

  log(`calculating VOR for ${year}`)

  // get player stats for year
  const query = db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'player.pname',
      'player.pos',
      'player.start',
      'player_gamelogs.pid',
      'nfl_games.week',
      'nfl_games.year'
    )
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')

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
    item.vorp = {}
    item.vorp_adj = {}
    item.market_salary = {}

    // set default values
    for (const week of weeks) {
      item.points[week] = { total: 0 }
      item.vorp[week] = -999
      item.vorp_adj[week] = 0
      item.market_salary[week] = 0
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

  log(`calculating VOR for ${rows.length} players`)

  const baselines = {}
  const baselineTotals = {}
  constants.positions.forEach((p) => (baselineTotals[p] = 0))
  for (const week of weeks) {
    const baseline = calculateBaselines({ players, league, week })
    baselines[week] = baseline

    for (const position of constants.positions) {
      const p = baseline[position].starter
      baselineTotals[position] += p.points[week].total
      log(
        `Baseline ${position} of week ${week} is ${p.pname} (${p.pos}) with ${p.points[week].total}pts`
      )
    }

    // calculate values
    const total = calculateValues({ players, baselines: baseline, week })
    calculatePrices({ cap: leagueTotalCap, total, players, week })
  }

  const points_by_position = {}
  for (const pos of constants.positions) {
    points_by_position[pos] = []
  }

  // calculate earned contract value
  let totalVorp = 0
  for (const player of players) {
    player.vorp.earned = 0
    player.starts = Object.values(player.vorp).filter((v) => v > 0).length
    player.points = sum(Object.values(player.points).map((p) => p.total))
    for (const value of Object.values(player.vorp)) {
      if (value <= 0) {
        continue
      }

      player.vorp.earned += value
      totalVorp += value
    }

    points_by_position[player.pos].push(player.points)
  }

  for (const pos of constants.positions) {
    points_by_position[pos] = points_by_position[pos].sort((a, b) => b - a)
  }

  for (const player of players) {
    player.pos_rnk = points_by_position[player.pos].indexOf(player.points) + 1
  }

  calculatePrices({
    cap: leagueTotalCap,
    total: totalVorp,
    players,
    week: 'earned'
  })

  const output = {}
  for (const player of players) {
    output[player.pid] = {
      player: player.pname,
      rookie: player.start === year,
      pos: player.pos,
      pos_rnk: player.pos_rnk,
      vor: player.vorp.earned,
      value: player.market_salary.earned,
      points: player.points,
      games: player.games,
      starts: player.starts
    }
  }

  if (rookie) {
    for (const pid in players) {
      const isRookie = output[pid].rookie
      if (!isRookie) {
        delete output[pid]
      }
    }
  }

  return { players: output, baselineTotals, weeks: weeks.length }
}

const main = async () => {
  try {
    const year = argv.year
    const rookie = argv.rookie
    const lid = argv.lid
    const week = argv.week
    if (!lid) {
      console.log('missing --lid')
      return
    }
    const league = await getLeague({ lid })
    const { players, baselineTotals, weeks } = await calculateVOR({
      year,
      rookie,
      league,
      week
    })
    const top200 = Object.values(players)
      .sort((a, b) => b.vor - a.vor)
      .slice(0, 200)
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
    for (const [index, player] of top200.entries()) {
      p.addRow(
        {
          index: index + 1,
          name: player.player,
          vor: player.vor.toFixed(2),
          points: player.points.toFixed(2),
          rank: `${player.pos}${player.pos_rnk}`,
          value: `$${player.value}`,
          rookie: player.rookie ? 'rookie' : '',
          startable: player.starts
        },
        {
          color: getColor(player.pos)
        }
      )
    }
    console.log(
      chalk.bold(
        `${year} ${rookie ? 'Rookie ' : ''}Player end-of-season values`
      )
    )
    p.printTable()

    for (const position of constants.positions) {
      const total = baselineTotals[position]
      const avg = total / weeks
      log(`${position} baseline per week: ${avg.toFixed(2)}`)
    }
  } catch (e) {
    log(e)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  debug.enable('calculate-vor')
  main()
}

export default calculateVOR
