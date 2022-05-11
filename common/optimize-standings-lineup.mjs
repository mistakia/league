import solver from 'javascript-lp-solver'

import * as constants from './constants.mjs'
import getOptimizerPositionConstraints from './get-optimizer-position-constraints.mjs'

export default function optimizeStandingsLineup({ players, league }) {
  const positions = players.map((p) => p.pos)
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
  const starters = Object.keys(result).filter(
    (r) => r.match(/^([A-Z]{2,})-([0-9]{4,})$/gi) || r.match(/^([A-Z]{1,3})$/gi)
  )

  return {
    total: result.result,
    starters,
    players
  }
}
