import solver from 'javascript-lp-solver'
import { constants, getOptimizerPositionConstraints } from '@common'

export function optimizeLineup ({
  limits = {},
  players,
  vbaseline,
  league,
  active = []
}) {
  const variables = {}
  const ints = {}

  const pool = players.concat(active)
  const positions = pool.map(p => p.pos1)
  const positionConstraints = getOptimizerPositionConstraints({ positions, league })
  const constraints = {
    value: { max: Math.round(league.cap * 0.8) },
    ...positionConstraints,
    ...limits
  }

  const addPlayer = ({ player, freeAgent }) => {
    variables[player.player] = {
      points: Math.round(player.points.ros.total || 0),
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

    if (freeAgent) {
      variables[player.player].fa = 1
      variables[player.player].value = Math.round(player.values.ros[vbaseline] || 0)
    }
  }

  active.forEach(player => addPlayer({ player, freeAgent: false }))
  players.forEach(player => addPlayer({ player, freeAgent: true }))

  const model = {
    optimize: 'points',
    opType: 'max',
    constraints,
    variables,
    ints
  }

  return solver.Solve(model)
}
