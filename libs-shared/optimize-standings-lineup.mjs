import solver from 'javascript-lp-solver'

import * as constants from './constants.mjs'
import getOptimizerPositionConstraints from './get-optimizer-position-constraints.mjs'

export default function optimizeStandingsLineup({ players, league }) {
  const positions = players.map((p) => p.pos)
  const constraints = getOptimizerPositionConstraints({ positions, league })

  const variables = {}
  const ints = {}

  for (const player of players) {
    variables[player.pid] = {
      points: player.points || 0,
      starter: 1
    }
    variables[player.pid][player.pid] = 1
    constraints[player.pid] = { max: 1 }
    ints[player.pid] = 1
    for (const pos of constants.positions) {
      variables[player.pid][pos] = player.pos === pos ? 1 : 0
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
    (r) =>
      r.match(constants.player_pid_regex) || r.match(constants.team_pid_regex)
  )

  return {
    total: result.result,
    starters,
    players
  }
}
