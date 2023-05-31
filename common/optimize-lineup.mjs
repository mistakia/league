import solver from 'javascript-lp-solver'

import * as constants from './constants.mjs'
import getOptimizerPositionConstraints from './get-optimizer-position-constraints.mjs'

export default function optimizeLineup({
  players,
  league,
  use_baseline_when_missing
}) {
  const results = {}
  const player_positions = players.map((p) => p.pos).filter(Boolean)
  const positions = use_baseline_when_missing
    ? player_positions.concat(constants.positions)
    : player_positions
  const constraints = getOptimizerPositionConstraints({ positions, league })

  const finalWeek = constants.season.finalWeek
  for (
    let week = Math.max(constants.season.week, 1);
    week <= finalWeek;
    week++
  ) {
    const variables = {}
    const ints = {}

    const addPlayer = ({ pid, player_pos, points }) => {
      variables[pid] = {
        points,
        starter: 1
      }
      variables[pid][pid] = 1
      constraints[pid] = { max: 1 }
      ints[pid] = 1
      for (const pos of constants.positions) {
        variables[pid][pos] = player_pos === pos ? 1 : 0
      }
    }

    for (const player of players) {
      const points = Math.round(
        (player.points && player.points[week] && player.points[week].total) || 0
      )
      addPlayer({ pid: player.pid, player_pos: player.pos, points })
    }

    if (use_baseline_when_missing) {
      for (const p of constants.positions) {
        const pos_pid = `pid_${p}`
        const points = Math.round(league[`b_${p}`]) || 0
        addPlayer({ pid: pos_pid, player_pos: p, points })
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
    const starter_pids = Object.keys(result).filter(
      (r) =>
        r.match(constants.player_pid_regex) || r.match(constants.team_pid_regex)
    )

    results[week] = {
      starter_pids
    }

    if (use_baseline_when_missing) {
      results[week].baseline_total = result.result
    } else {
      results[week].total = result.result
    }
  }

  return results
}
