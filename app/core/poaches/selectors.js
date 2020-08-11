import { Map } from 'immutable'

import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'

export function getPoachesForCurrentLeague (state) {
  const { leagueId } = getApp(state)
  return state.get('poaches').get(leagueId) || new Map()
}

export function getPoachPlayersForCurrentLeague (state) {
  let poaches = getPoachesForCurrentLeague(state)

  for (const poach of poaches.values()) {
    const playerId = poach.player
    const player = getPlayerById(state, { playerId })
    poaches = poaches.setIn([playerId, 'player'], player)
    if (poach.drop) {
      const playerId = poach.drop
      const player = getPlayerById(state, { playerId })
      poaches = poaches.setIn([playerId, 'drop'], player)
    }
  }

  return poaches.valueSeq().toList()
}
