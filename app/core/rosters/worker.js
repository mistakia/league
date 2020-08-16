import solver from 'javascript-lp-solver'
import {
  constants,
  getOptimizerPositionConstraints
} from '@common'

export function optimizeLineup ({ players, league }) {
  const results = {}
  const positions = players.map(p => p.pos1)
  const constraints = getOptimizerPositionConstraints({ positions, league })

  for (let week = 1; week <= constants.season.finalWeek; week++) {
    const variables = {}
    const ints = {}

    for (const player of players) {
      variables[player.player] = {
        points: Math.round(player.points[week].total || 0),
        starter: 1
      }
      variables[player.player][player.player] = 1
      constraints[player.player] = { max: 1 }
      ints[player.player] = 1
      for (const pos of constants.positions) {
        variables[player.player][pos] = player.pos1 === pos ? 1 : 0
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

    results[week] = {
      total: result.result,
      starters
    }
  }

  return results
}
