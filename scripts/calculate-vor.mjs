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

const calculateVOR = async ({ year, rookie, league }) => {
  if (!Number.isInteger(year)) {
    throw new Error(`${year} invalid year`)
  }

  const { nteams, cap, minBid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = nteams * cap - nteams * rosterSize * minBid

  log(`calculating VOR for ${year}`)

  // get player stats for year
  const rows = await db('gamelogs')
    .select(
      'gamelogs.*',
      'player.pname',
      'player.pos',
      'player.start',
      'gamelogs.pid'
    )
    .where('gamelogs.year', year)
    .andWhere('gamelogs.week', '<=', constants.season.finalWeek)
    .join('player', 'gamelogs.pid', 'player.pid')

  const pids = rows.map((p) => p.pid)
  const sub = db('rankings')
    .select(db.raw('max(timestamp) AS maxtime, sourceid AS sid'))
    .groupBy('sid')
    .where('year', year)
  const rankings = await db('rankings')
    .select('*')
    .from(db.raw('(' + sub.toString() + ') AS X'))
    .innerJoin('rankings', function () {
      this.on(function () {
        this.on('sourceid', '=', 'sid')
        this.andOn('timestamp', '=', 'maxtime')
      })
    })
    .where('sf', 1)
    .where('year', year)
    .whereIn('pid', pids)

  const grouped_by_pid = groupBy(rows, 'pid')

  const players = []
  for (const pid of Object.keys(grouped_by_pid)) {
    let item = {}
    const games = grouped_by_pid[pid]
    // item.games = games

    const ranking = rankings.find((r) => r.pid === pid)
    if (ranking) {
      const { ornk, prnk, avg, std } = ranking
      item = { ornk, prnk, avg, std }
    }

    item.points = {}
    item.vorp = {}
    item.vorp_adj = {}
    item.market_salary = {}

    for (let week = 0; week <= constants.season.finalWeek; week++) {
      item.points[week] = { total: 0 }
      item.vorp[week] = -999
      item.vorp_adj[week] = 0
      item.market_salary[week] = 0
    }

    for (const game of games) {
      // calculate fantasy points
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
  const max_week = Math.max(...rows.map((r) => r.week))
  for (let week = 1; week <= max_week; week++) {
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
      prnk: player.prnk,
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

  return { players: output, baselineTotals, weeks: max_week }
}

const main = async () => {
  try {
    const year = argv.year
    const rookie = argv.rookie
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }
    const league = await getLeague(lid)
    const { players, baselineTotals, weeks } = await calculateVOR({
      year,
      rookie,
      league
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
          pid: player.pid,
          vor: player.vor.toFixed(2),
          points: player.points.toFixed(2),
          rank: player.prnk,
          value: `$${player.value}`,
          pos: player.pos,
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
