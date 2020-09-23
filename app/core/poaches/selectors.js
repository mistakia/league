import { Map } from 'immutable'

import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'
import { getCurrentPlayers } from '@core/rosters'

export function getPoachesForCurrentLeague (state) {
  const { leagueId } = getApp(state)
  return state.get('poaches').get(leagueId) || new Map()
}

export function getActivePoachesAgainstMyPlayers (state) {
  const poaches = getPoachesForCurrentLeague(state)
  const players = getCurrentPlayers(state)
  const playerIds = players.practice.map(p => p.player)
  return poaches.filter(p => playerIds.includes(p.player))
}

export function getPoachPlayersForCurrentTeam (state) {
  let poaches = getPoachesForCurrentLeague(state)
  const { teamId } = getApp(state)

  for (const poach of poaches.values()) {
    if (poach.tid !== teamId) continue
    const playerId = poach.player
    const player = getPlayerById(state, { playerId })
    poaches = poaches.setIn([playerId, 'player'], player)
  }

  return poaches.valueSeq().toList()
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
