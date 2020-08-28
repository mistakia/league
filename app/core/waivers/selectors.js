import { Map, List } from 'immutable'

import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'
import { constants } from '@common'

export function getWaiversForCurrentTeam (state) {
  const { teamId } = getApp(state)
  return state.get('waivers').get(teamId)
}

export function getWaiverPlayersForCurrentTeam (state) {
  let teamWaivers = getWaiversForCurrentTeam(state) || new Map()
  for (const waiver of teamWaivers.values()) {
    const playerId = waiver.player
    const player = getPlayerById(state, { playerId })
    teamWaivers = teamWaivers.setIn([waiver.uid, 'player'], player)
    if (waiver.drop) {
      const playerId = waiver.drop
      const player = getPlayerById(state, { playerId })
      teamWaivers = teamWaivers.setIn([playerId, 'drop'], player)
    }
  }

  const waivers = teamWaivers.valueSeq().toList()
  const sorted = waivers.sort((a, b) => b.bid - a.bid || a.po - b.po || a.uid - b.uid)
  let poach = new List()
  let active = new List()
  let practice = new List()
  for (const w of sorted) {
    if (w.type === constants.waivers.FREE_AGENCY) {
      active = active.push(w)
    } else if (w.type === constants.waivers.FREE_AGENCY_PRACTICE) {
      practice = practice.push(w)
    } else if (w.type === constants.waivers.POACH) {
      poach = poach.push(w)
    }
  }

  return { poach, active, practice }
}
