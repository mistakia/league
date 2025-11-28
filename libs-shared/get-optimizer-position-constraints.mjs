import get_eligible_slots from './get-eligible-slots.mjs'
import { fantasy_positions } from '#constants'

const getPositionCount = (players) =>
  players.reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map())

export default function ({ positions, league }) {
  const rosterConstraints = {}
  for (const pos of fantasy_positions) {
    rosterConstraints[pos] = {
      max: get_eligible_slots({ pos, league }).length,
      min: league[`s${pos.toLowerCase()}`]
    }
  }

  const constraints = {
    starter: { max: 0, min: 0 }
  }

  const positionCount = getPositionCount(positions)
  for (const [pos, min] of positionCount.entries()) {
    if (rosterConstraints[pos]) {
      const posMin = Math.min(min, rosterConstraints[pos].min)
      constraints[pos] = Object.assign({}, rosterConstraints[pos])
      constraints[pos].min = posMin
      constraints.starter.max += posMin
      constraints.starter.min += posMin
      positionCount.set(pos, Math.max(min - rosterConstraints[pos].min, 0))
    } else {
      constraints[pos] = { min: 0, max: 0, starter: { max: 0, min: 0 } }
    }
  }

  const processFlex = (positions, flexCount) => {
    const pos = positions.shift()
    const posCount = positionCount.get(pos)
    if (!posCount) {
      if (positions.length) processFlex(positions, flexCount)
      return
    }

    positionCount.set(pos, Math.max(posCount - flexCount, 0))
    const min = Math.min(posCount, flexCount)
    constraints.starter.max += min
    constraints.starter.min += min
    if (min < flexCount && positions.length) processFlex(positions, flexCount)
  }

  if (league.srbwr) {
    processFlex(['RB', 'WR'], league.srbwr)
  }

  if (league.swrte) {
    processFlex(['WR', 'TE'], league.swrte)
  }

  if (league.srbwrte) {
    processFlex(['RB', 'WR', 'TE'], league.srbwrte)
  }

  if (league.sqbrbwrte) {
    processFlex(['QB', 'RB', 'WR', 'TE'], league.sqbrbwrte)
  }

  return constraints
}
