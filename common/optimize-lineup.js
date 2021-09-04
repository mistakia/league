import solver from 'javascript-lp-solver'

import * as constants from './constants'
import getOptimizerPositionConstraints from './get-optimizer-position-constraints'

export default function optimizeLineup({ players, league }) {
  const results = {}
  const positions = players.map((p) => p.pos)
  const constraints = getOptimizerPositionConstraints({ positions, league })

  const finalWeek = constants.season.finalWeek
  for (
    let week = Math.max(constants.season.week, 1);
    week <= finalWeek;
    week++
  ) {
    const variables = {}
    const ints = {}

    for (const player of players) {
      variables[player.player] = {
        points: Math.round(
          (player.points[week] && player.points[week].total) || 0
        ),
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
      (r) =>
        r.match(/^([A-Z]{2,})-([0-9]{4,})$/gi) || r.match(/^([A-Z]{1,3})$/gi)
    )

    results[week] = {
      total: result.result,
      starters
    }
  }

  return results
}
