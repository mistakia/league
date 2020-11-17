import solver from 'javascript-lp-solver'
import { constants, calculatePoints, getOptimizerPositionConstraints } from '@common'

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
      points: {},
      potentialPoints: {},

      wins: 0,
      losses: 0,
      ties: 0,

      allPlayWins: 0,
      allPlayLosses: 0,
      allPlayTies: 0,

      pointsFor: 0,
      pointsAgainst: 0,
      potentialPointsFor: 0,

      draftOrderIndex: 0
    }
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
          console.log(`missing gamelog ${week} ${player}`)
          continue
        }

        result[tid].gamelogs.push(gamelog)
        const points = calculatePoints({ stats: gamelog, position: pos, league })
        result[tid].games[week][player] = points.total
        if (starterIds.includes(player)) total = points.total + total
        optimizePlayers.push({
          player,
          pos,
          points: points.total
        })
      }

      // calculate optimal lineup
      const optimizeResult = optimizeLineup({ players: optimizePlayers, league })
      result[tid].potentialPoints[week] = optimizeResult.total
      result[tid].potentialPointsFor += optimizeResult.total

      result[tid].points[week] = total
      result[tid].pointsFor += total
    }
  }

  for (let week = 1; week < constants.season.week; week++) {
    const weekMatchups = matchups.filter(m => m.week === week)
    for (const m of weekMatchups) {
      const homeScore = result[m.hid].points[week]
      const awayScore = result[m.aid].points[week]

      result[m.hid].pointsAgainst += awayScore
      result[m.aid].pointsAgainst += homeScore

      if (homeScore > awayScore) {
        result[m.hid].wins += 1
        result[m.aid].losses += 1
      } else if (homeScore < awayScore) {
        result[m.hid].losses += 1
        result[m.aid].wins += 1
      } else {
        result[m.hid].ties += 1
        result[m.aid].ties += 1
      }
    }

    // calculate all play record
    const scores = Object.values(result).map(p => p.points[week])
    for (const tid of tids) {
      const score = result[tid].points[week]
      result[tid].allPlayWins += scores.filter(p => p < score).length
      result[tid].allPlayLosses += scores.filter(p => p > score).length
      result[tid].allPlayTies += scores.filter(p => p === score).length
    }
  }

  // calculate draft order
  const potentialPoints = Object.values(result).map(p => p.potentialPointsFor)
  const allPlayLosses = Object.values(result).map(p => p.allPlayLosses)
  const minPP = Math.min(...potentialPoints)
  const maxPP = Math.max(...potentialPoints)
  const minAPL = Math.min(...allPlayLosses)
  const maxAPL = Math.max(...allPlayLosses)
  for (const tid of tids) {
    const pp = result[tid].potentialPointsFor
    const apl = result[tid].allPlayLosses
    const normPP = (pp - minPP) / (maxPP - minPP)
    const normAPL = (apl - minAPL) / (maxAPL - minAPL)
    result[tid].draftOrderIndex = (9 * normPP) + normAPL
  }

  return result
}
