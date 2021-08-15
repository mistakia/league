// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const debug = require('debug')
const chalk = require('chalk')
const argv = require('yargs').argv
const { Table } = require('console-table-printer')

const db = require('../db')

const { getLeague } = require('../utils')
const {
  constants,
  groupBy,
  getPlayerCountBySlot,
  getActiveRosterLimit,
  calculatePoints
} = require('../common')

const log = debug('calculate-vor')
debug.enable('calculate-vor')

const POSITIONS = ['QB', 'RB', 'WR', 'TE']

// Stats is an object with positions as properties and player stats as values
// i.e. { QB: [{ player1 }, { player2 }, ... ], RB: [{ player1 }, { player2 }, ... ] ... }
const getBaselinePlayers = ({ stats, playerCount }) => {
  const baselinePlayers = {}
  for (const position of POSITIONS) {
    baselinePlayers[position] = stats[position].slice(playerCount[position])
  }

  if (!playerCount.RBWRTE && !playerCount.QBRBWRTE && !playerCount.RBWR) {
    const result = {}
    for (const position of POSITIONS) {
      result[position] = baselinePlayers[position][0]
    }
    return result
  }

  let baselineRBWR
  let baselineRBWRTE
  let baselineQBRBWRTE

  if (playerCount.RBWR) {
    const rbwr = baselinePlayers.RB.concat(baselinePlayers.WR).sort(
      (b, a) => b.points - a.points
    )
    baselineRBWR = rbwr.slice(playerCount.RBWR)
  }

  /* eslint-disable indent */
  if (playerCount.RBWRTE) {
    const rbwrte = baselineRBWR
      ? baselineRBWR
          .concat(baselinePlayers.TE)
          .sort((a, b) => b.points - a.points)
      : baselinePlayers.RB.concat(baselinePlayers.WR, baselinePlayers.TE).sort(
          (a, b) => b.points - a.points
        )

    baselineRBWRTE = rbwrte.slice(playerCount.RBWRTE)
  }
  /* eslint-enable indent */

  if (playerCount.QBRBWRTE) {
    const sf = baselineRBWR
      ? baselineRBWRTE
          .concat(baselinePlayers.QB)
          .sort((a, b) => b.points - a.points)
      : baselineRBWR
      ? baselineRBWR
          .concat(baselinePlayers.QB)
          .sort((a, b) => b.points - a.points)
      : baselinePlayers.RB.concat(
          baselinePlayers.WR,
          baselinePlayers.TE,
          baselinePlayers.QB
        ).sort((a, b) => b.points - a.points)

    baselineQBRBWRTE = sf.slice(playerCount.QBRBWRTE)
  }

  const qbBaseline = playerCount.QBRBWRTE
    ? baselineQBRBWRTE[0]
    : baselinePlayers.QB[0]

  if (playerCount.RBWRTE) {
    return {
      QB: qbBaseline,
      RB: baselineRBWRTE[0],
      WR: baselineRBWRTE[0],
      TE: baselineRBWRTE[0]
    }
  }

  return {
    QB: qbBaseline,
    RB: baselineRBWR[0],
    WR: baselineRBWR[0],
    TE: baselineRBWR[0]
  }
}

const calculateVOR = async ({ year, rookie, league }) => {
  if (!Number.isInteger(year)) {
    throw new Error(`${year} invalid year`)
  }

  log(`calculating VOR for ${year}`)

  // get player stats for year
  const rows = await db('offense')
    .select(
      'offense.*',
      'player.pname',
      'player.pos',
      'game.wk',
      'offense.player',
      'offense.seas'
    )
    .where('offense.year', year)
    .andWhere('game.wk', '<=', constants.season.finalWeek)
    .join('player', 'offense.player', 'player.player')
    .join('game', 'offense.gid', 'game.gid')

  const playerIds = rows.map((p) => p.player)
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
    .whereIn('player', playerIds)

  for (let row of rows) {
    const ranking = rankings.find((r) => r.player === row.player)
    if (ranking) {
      const { ornk, prnk, avg, std } = ranking
      row = { ...row, ornk, prnk, avg, std }
    }
  }

  log(`calculating VOR for ${rows.length} players`)

  // calculate fantasy points
  for (const row of rows) {
    const points = calculatePoints({ stats: row, position: row.pos, league })
    row.points = points.total
  }

  // group by position
  const statsByPosition = {}
  for (const position of POSITIONS) {
    statsByPosition[position] = rows
      .filter((p) => p.pos === position)
      .sort((a, b) => b.points - a.points)
  }

  // calculate VOR by week
  let stats = []
  for (let week = 1; week <= constants.season.finalWeek; week++) {
    const weekStatsByPosition = {}
    for (const position of POSITIONS) {
      weekStatsByPosition[position] = statsByPosition[position].filter(
        (p) => p.wk === week
      )
      log(
        `Top ${position} of week ${week} is ${weekStatsByPosition[position][0].pname} with ${weekStatsByPosition[position][0].points}pts`
      )
    }

    // get player VOR baselines
    const playerCount = getPlayerCountBySlot({ league })
    const baselinePlayers = getBaselinePlayers({
      stats: weekStatsByPosition,
      playerCount
    })

    for (const position of POSITIONS) {
      const p = baselinePlayers[position]
      log(
        `Baseline ${position} of week ${week} is ${p.pname} with ${p.points}pts`
      )
    }

    // calculate individual VOR
    for (const position of POSITIONS) {
      const baselinePlayer = baselinePlayers[position]
      for (const player of weekStatsByPosition[position]) {
        player.vor = player.points - baselinePlayer.points
      }
    }
    const weeklyPlayerStats = Object.values(weekStatsByPosition).flat()
    stats = stats.concat(weeklyPlayerStats)
  }

  // group results by player
  const players = groupBy(stats, 'player')

  // add up player vor
  const output = {}
  let totalVOR = 0
  for (const player in players) {
    const games = players[player]
    const vor = games.reduce((a, b) => a + (b.vor || 0), 0)
    const points = games.reduce((a, b) => a + (b.points || 0), 0)
    if (vor > 0) {
      totalVOR = totalVOR + vor
    }
    output[player] = {
      player: games[0].pname,
      rookie: games[0].seas === 1,
      pos: games[0].pos,
      seas: games[0].seas,
      prnk: games[0].prnk,
      vor,
      points,
      games
    }
  }

  // set player contract value
  const rosterLimit = getActiveRosterLimit(league)
  const leagueCAP = league.nteams * league.cap - league.nteams * rosterLimit
  const pricePerVOR = leagueCAP / totalVOR
  for (const player in players) {
    const vor = output[player].vor
    const value = Math.round(pricePerVOR * vor)
    output[player].value = value > 0 ? value : 0
  }

  if (rookie) {
    for (const player in players) {
      const isRookie = output[player].rookie
      if (!isRookie) {
        delete output[player]
      }
    }
  }

  return output
}

module.exports = calculateVOR

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
    const results = await calculateVOR({ year, rookie, league })
    const top200 = Object.values(results)
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
          player: player.player,
          vor: player.vor.toFixed(2),
          points: player.points.toFixed(2),
          rank: player.prnk,
          value: `$${player.value}`,
          pos: player.pos,
          rookie: player.rookie ? 'rookie' : ''
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
  } catch (e) {
    log(e)
  }

  process.exit()
}

if (!module.parent) {
  debug.enable('calculate-vor')
  main()
}
