import solver from 'javascript-lp-solver'

import {
  fantasy_positions,
  current_season,
  player_id_regex,
  team_id_regex
} from '#constants'
import getOptimizerPositionConstraints from './get-optimizer-position-constraints.mjs'

export default function optimizeLineup({
  players,
  league,
  use_baseline_when_missing
}) {
  const results = {}
  const player_positions = players.map((p) => p.pos).filter(Boolean)
  const positions = use_baseline_when_missing
    ? player_positions.concat(fantasy_positions)
    : player_positions
  const constraints = getOptimizerPositionConstraints({ positions, league })

  const finalWeek = current_season.finalWeek
  for (let week = Math.max(current_season.week, 1); week <= finalWeek; week++) {
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
      for (const pos of fantasy_positions) {
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
      for (const p of fantasy_positions) {
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
      (r) => r.match(player_id_regex) || r.match(team_id_regex)
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
