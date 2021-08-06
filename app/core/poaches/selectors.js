import { Map, List } from 'immutable'

import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'
import { getCurrentPlayers } from '@core/rosters'

export function getPoachesForCurrentLeague(state) {
  const { leagueId } = getApp(state)
  return state.get('poaches').get(leagueId) || new Map()
}

export function getActivePoachesAgainstMyPlayers(state) {
  const poaches = getPoachesForCurrentLeague(state)
  const players = getCurrentPlayers(state)
  const playerIds = players.practice.map((p) => p.player)
  return poaches.filter((p) => playerIds.includes(p.player))
}

export function getPoachPlayersForCurrentTeam(state) {
  const poaches = getPoachesForCurrentLeague(state)
  const { teamId } = getApp(state)

  let poachPlayers = new List()
  for (const poach of poaches.valueSeq()) {
    if (poach.tid !== teamId) continue
    const playerId = poach.player
    const player = getPlayerById(state, { playerId })
    poachPlayers = poachPlayers.push(poach.set('player', player))
  }

  return poachPlayers
}

export function getPoachPlayersForCurrentLeague(state) {
  let poaches = getPoachesForCurrentLeague(state)

  for (const poach of poaches.values()) {
    const playerId = poach.player
    const player = getPlayerById(state, { playerId })
    poaches = poaches.setIn([playerId, 'player'], player)
    if (poach.release.size) {
      const releases = []
      for (const playerId of poach.release) {
        const player = getPlayerById(state, { playerId })
        releases.push(player)
      }
      poaches = poaches.setIn([playerId, 'release'], new List(releases))
    }
  }

  return poaches.valueSeq().toList()
}
