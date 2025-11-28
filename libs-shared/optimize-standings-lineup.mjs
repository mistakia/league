import solver from 'javascript-lp-solver'

import { fantasy_positions, player_id_regex, team_id_regex } from '#constants'
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
    for (const pos of fantasy_positions) {
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
    (r) => r.match(player_id_regex) || r.match(team_id_regex)
  )

  return {
    total: result.result,
    starters,
    players
  }
}
