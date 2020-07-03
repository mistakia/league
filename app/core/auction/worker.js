import solver from 'javascript-lp-solver'
import { constants } from '@common'

export function optimizeLineup ({ constraints, players }) {
  const variables = {}
  const ints = {}

  for (const player of players) {
    variables[player.player] = {
      points: Math.round(player.points.total || 0),
      value: Math.round(player.values.hybrid || 0),
      starter: 1
    }
    variables[player.player][player.player] = 1
    // variables[player.player][player.pos1] = 1
    if (constraints[player.player]) {
      constraints[player.player].max = 1
    } else {
      constraints[player.player] = { max: 1 }
    }
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

  return solver.Solve(model)
}
