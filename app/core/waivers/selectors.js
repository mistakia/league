import { Map } from 'immutable'
import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'

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
  }

  return teamWaivers.valueSeq().toList()
}
