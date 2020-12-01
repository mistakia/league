import solver from 'javascript-lp-solver'
import { std } from 'mathjs'
import {
  constants,
  calculatePoints,
  getOptimizerPositionConstraints,
  calculatePercentiles
} from '@common'

function optimizeLineup ({ players, league }) {
  const positions = players.map(p => p.pos)
  const constraints = getOptimizerPositionConstraints({ positions, league })

  const variables = {}
  const ints = {}

  for (const player of players) {
    variables[player.player] = {
      points: player.points || 0,
      starter: 1
    }
    variables[player.player][player.player] = 1
    constraints[player.player] = { max: 1 }
    ints[player.player] = 1
    for (const pos of constants.positions) {
      variables[player.player][pos] = player.pos === pos ? 1 : 0
    }
  }

  const model = {
    optimize: 'points',
    opType: 'max',
    constraints,
    variables,
    ints
  }

  const result = solver.Solve(model)
  const starters = Object.keys(result)
    .filter(r => r.match(/^([A-Z]{2,})-([0-9]{4,})$/ig) || r.match(/^([A-Z]{1,3})$/ig))

  return {
    total: result.result,
    starters,
    players
  }
}

export function calculate ({
  league,
  tids,
  starters,
  active,
  gamelogs,
  matchups
}) {
  const result = {}
  for (const tid of tids) {
    result[tid] = {
      tid,
      gamelogs: [],
      games: {},
      points: {
        weeks: {}
      },
      stats: constants.createFantasyTeamStats(),
      potentialPoints: {}
    }

    result[tid].stats.pmin = 99999
  }

  for (let week = 1; week < constants.season.week; week++) {
    for (const tid of tids) {
      const startingPlayers = starters[week][tid]
      const starterIds = startingPlayers.map(p => p.player)
      let total = 0
      result[tid].games[week] = {}
      const optimizePlayers = []
      for (const { player, pos } of active[week][tid]) {
        const gamelog = gamelogs.find(g => g.week === week && g.player === player)
        if (!gamelog) {
          continue
        }

        result[tid].gamelogs.push(gamelog)
        const points = calculatePoints({ stats: gamelog, position: pos, league })
        result[tid].games[week][player] = points.total
        if (starterIds.includes(player)) {
          const starter = startingPlayers.find(p => p.player === player)
          total = points.total + total
          result[tid].stats[`pPos${pos}`] += points.total
          result[tid].stats[`pSlot${starter.slot}`] += points.total
        }
        optimizePlayers.push({
          player,
          pos,
          points: points.total
        })
      }

      // calculate optimal lineup
      const optimizeResult = optimizeLineup({ players: optimizePlayers, league })
      result[tid].potentialPoints[week] = optimizeResult.total
      result[tid].stats.pp += optimizeResult.total

      if (result[tid].stats.pmax < total) result[tid].stats.pmax = total
      if (result[tid].stats.pmin > total) result[tid].stats.pmin = total

      result[tid].points.weeks[week] = total
      result[tid].stats.pf += total
    }
  }

  for (let week = 1; week < constants.season.week; week++) {
    const weekMatchups = matchups.filter(m => m.week === week)
    for (const m of weekMatchups) {
      const homeScore = result[m.hid].points.weeks[week]
      const awayScore = result[m.aid].points.weeks[week]

      result[m.hid].stats.pa += awayScore
      result[m.aid].stats.pa += homeScore

      if (homeScore > awayScore) {
        result[m.hid].stats.wins += 1
        result[m.aid].stats.losses += 1
      } else if (homeScore < awayScore) {
        result[m.hid].stats.losses += 1
        result[m.aid].stats.wins += 1
      } else {
        result[m.hid].stats.ties += 1
        result[m.aid].stats.ties += 1
      }
    }

    // calculate all play record

    for (const tid of tids) {
      const scores = Object.values(result)
        .filter(p => p.tid !== tid)
        .map(p => p.points.weeks[week])
      const score = result[tid].points.weeks[week]
      result[tid].stats.apWins += scores.filter(p => p < score).length
      result[tid].stats.apLosses += scores.filter(p => p > score).length
      result[tid].stats.apTies += scores.filter(p => p === score).length
    }
  }

  // calculate draft order
  const potentialPoints = Object.values(result).map(p => p.stats.pp)
  const allPlayLosses = Object.values(result).map(p => p.stats.apLosses)
  const minPP = Math.min(...potentialPoints)
  const maxPP = Math.max(...potentialPoints)
  const minAPL = Math.min(...allPlayLosses)
  const maxAPL = Math.max(...allPlayLosses)
  for (const tid of tids) {
    const pp = result[tid].stats.pp
    const apl = result[tid].stats.apLosses
    const normPP = (pp - minPP) / (maxPP - minPP)
    const normAPL = (apl - minAPL) / (maxAPL - minAPL)
    result[tid].stats.doi = (9 * normPP) + normAPL

    const points = Object.values(result[tid].points.weeks)
    result[tid].stats.pdev = std(points)
    result[tid].stats.pdiff = result[tid].stats.pf - result[tid].stats.pa
    result[tid].stats.pp_pct = (result[tid].stats.pf / result[tid].stats.pp) * 100
  }

  const percentiles = calculatePercentiles({
    items: Object.values(result).map(t => t.stats),
    stats: constants.fantasyTeamStats
  })

  return { teams: result, percentiles }
}
