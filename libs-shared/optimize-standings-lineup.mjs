import solver from 'javascript-lp-solver'

import { fantasy_positions, player_id_regex, team_id_regex } from '#constants'
import getOptimizerPositionConstraints from './get-optimizer-position-constraints.mjs'

export default function optimizeStandingsLineup({ players, league }) {
  // `players` here are synthetic optimize candidates { pid, pos, points }
  // built by callers (calculate-standings, getOptimalPointsByTeamId, the
  // simulation optimal-lineup helpers); `pos` is a generic position code, not
  // the player-dimension primary_position column.
  const positions = players.map((optimize_player) => optimize_player.pos)
  const constraints = getOptimizerPositionConstraints({ positions, league })

  const variables = {}
  const ints = {}

  for (const optimize_player of players) {
    variables[optimize_player.pid] = {
      points: optimize_player.points || 0,
      starter: 1
    }
    variables[optimize_player.pid][optimize_player.pid] = 1
    constraints[optimize_player.pid] = { max: 1 }
    ints[optimize_player.pid] = 1
    for (const pos of fantasy_positions) {
      variables[optimize_player.pid][pos] = optimize_player.pos === pos ? 1 : 0
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
