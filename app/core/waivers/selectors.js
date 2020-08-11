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
  const sorted = waivers.sort((a, b) => a.po - b.po)
  let poach = new List()
  let freeAgency = new List()
  for (const w of sorted) {
    if (w.type === constants.waivers.FREE_AGENCY) {
      freeAgency = freeAgency.push(w)
    } else {
      poach = poach.push(w)
    }
  }

  return { poach, freeAgency }
}
