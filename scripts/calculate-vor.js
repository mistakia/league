// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const debug = require('debug')
const chalk = require('chalk')
const argv = require('yargs').argv
const { Table } = require('console-table-printer')

const db = require('../db')

const { groupBy } = require('../common')

const log = debug('script:calculate-vor')

const TEAMS = 12
const TEAM_CAP = 200
const ROSTER_SIZE = 17
const LAST_WEEK_OF_SEASON = 16
const POSITIONS = ['QB', 'RB', 'WR', 'TE']
const LEAGUE_SCORING = {
  ints: -0.5,
  tdp: 4,
  py: 0.05,
  ry: 0.1,
  tdr: 6,
  rec: 0.5,
  recy: 0.1,
  tdrec: 6,
  tdret: 6,
  fuml: -1,
  conv: 2
}

const calculatePoints = (stats, scoring) => {
  let points = 0
  for (const stat in scoring) {
    const modifier = scoring[stat]
    const value = stats[stat]
    points = points + (modifier * value)
  }
  return points
}

const getStartersByPosition = () => {
  const TEAMS = 12
  const slots = {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    SF: 1,
    RBWRTE: 1,
    DEF: 1,
    K: 1
  }

  const result = {}
  for (const slot in slots) {
    result[slot] = slots[slot] * TEAMS
  }

  return result
}

// Stats is an object with positions as properties and player stats as values
// i.e. { QB: [{ player1 }, { player2 }, ... ], RB: [{ player1 }, { player2 }, ... ] ... }
const getBaselinePlayers = ({ stats, starters }) => {
  const baselinePlayers = {}
  for (const position of POSITIONS) {
    baselinePlayers[position] = stats[position].slice(starters[position])
  }

  if (!starters.RBWRTE && !starters.SF && !starters.RBWR) {
    const result = {}
    for (const position of POSITIONS) {
      result[position] = baselinePlayers[position][0]
    }
    return result
  }

  let baselineRBWR
  let baselineRBWRTE
  let baselineSF

  if (starters.RBWR) {
    const rbwr = baselinePlayers.RB.concat(baselinePlayers.WR).sort((b, a) => b.points - a.points)
    baselineRBWR = rbwr.slice(starters.RBWR)
  }

  if (starters.RBWRTE) {
    const rbwrte = baselineRBWR
      ? baselineRBWR.concat(baselinePlayers.TE).sort((a, b) => b.points - a.points)
      : baselinePlayers.RB.concat(baselinePlayers.WR, baselinePlayers.TE).sort((a, b) => b.points - a.points)

    baselineRBWRTE = rbwrte.slice(starters.RBWRTE)
  }

  if (starters.SF) {
    const sf = baselineRBWR
      ? baselineRBWRTE.concat(baselinePlayers.QB).sort((a, b) => b.points - a.points)
      : (baselineRBWR
        ? baselineRBWR.concat(baselinePlayers.QB).sort((a, b) => b.points - a.points)
        : baselinePlayers.RB.concat(baselinePlayers.WR, baselinePlayers.TE, baselinePlayers.QB).sort((a, b) => b.points - a.points))

    baselineSF = sf.slice(starters.SF)
  }

  const qbBaseline = starters.SF ? baselineSF[0] : baselinePlayers.QB[0]

  if (starters.RBWRTE) {
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

const calculateVOR = async ({ year, rookie }) => {
  if (!Number.isInteger(year)) {
    throw new Error(`${year} invalid year`)
  }

  log(`calculating VOR for ${year}`)

  // get player stats for year
  const rows = await db('offense')
    .select('offense.*', 'player.pname', 'player.pos', 'game.wk', 'offense.player', 'offense.seas', 'draft_rankings.rank', 'draft_rankings.posrank', 'draft_rankings.avg')
    .where('offense.year', year)
    .andWhere('game.wk', '<=', LAST_WEEK_OF_SEASON)
    .andWhere('draft_rankings.seas', year)
    .andWhere('draft_rankings.rookie', 0) // TODO figure out how to only include one row
    .join('player', 'offense.player', 'player.player')
    .join('game', 'offense.gid', 'game.gid')
    .join('draft_rankings', 'offense.player', 'draft_rankings.player')

  log(`calculating VOR for ${rows.length} players`)

  // calculate fantasy points
  for (const row of rows) {
    row.points = calculatePoints(row, LEAGUE_SCORING)
  }

  // group by position
  const statsByPosition = {}
  for (const position of POSITIONS) {
    statsByPosition[position] = rows.filter(p => p.pos === position).sort((a, b) => b.points - a.points)
  }

  // calculate VOR by week
  let stats = []
  for (let week = 1; week <= LAST_WEEK_OF_SEASON; week++) {
    const weekStatsByPosition = {}
    for (const position of POSITIONS) {
      weekStatsByPosition[position] = statsByPosition[position].filter(p => p.wk === week)
      log(`Top ${position} of week ${week} is ${weekStatsByPosition[position][0].pname} with ${weekStatsByPosition[position][0].points}pts`)
    }

    // get player VOR baselines
    const starters = getStartersByPosition()
    const baselinePlayers = getBaselinePlayers({ stats: weekStatsByPosition, starters })

    for (const position of POSITIONS) {
      const p = baselinePlayers[position]
      log(`Baseline ${position} of week ${week} is ${p.pname} with ${p.points}pts`)
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
      posrank: games[0].posrank,
      vor,
      points,
      games
    }
  }

  // set player contract value
  const leagueCAP = (TEAMS * TEAM_CAP) - (TEAMS * ROSTER_SIZE)
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

if (!module.parent) {
  debug.enable('script:calculate-vor')
  const main = async () => {
    try {
      const year = argv.year
      const rookie = argv.rookie
      const results = await calculateVOR({ year, rookie })
      const top200 = Object.values(results).sort((a, b) => b.vor - a.vor).slice(0, 200)
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
        p.addRow({
          index: index + 1,
          player: player.player,
          vor: player.vor.toFixed(2),
          points: player.points.toFixed(2),
          rank: player.posrank,
          value: `$${player.value}`,
          pos: player.pos,
          rookie: player.rookie ? 'rookie' : ''
        }, {
          color: getColor(player.pos)
        })
      }
      console.log(chalk.bold(`${year} ${rookie ? 'Rookie ' : ''}Player end-of-season values`))
      p.printTable()
    } catch (e) {
      log(e)
    }
  }

  main()
}
