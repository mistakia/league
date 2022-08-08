import { Map, List } from 'immutable'

import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'
import { getCurrentPlayers } from '@core/rosters'
import { constants } from '@common'
import { Poach } from './poach'

export function getPoachesForCurrentLeague(state) {
  const { leagueId } = getApp(state)
  return state.get('poaches').get(leagueId) || new Map()
}

export function getPoachById(state, { poachId }) {
  const poaches = getPoachesForCurrentLeague(state)
  return poaches.find((p) => p.uid === poachId) || new Poach()
}

export function getPoachReleasePlayers(state, { poachId }) {
  const poach = getPoachById(state, { poachId })
  return poach.release.map((pid) => getPlayerById(state, { pid }))
}

export function getActivePoachesAgainstMyPlayers(state) {
  const poaches = getPoachesForCurrentLeague(state)
  const players = getCurrentPlayers(state)
  const pids = players.practice.map((pMap) => pMap.get('pid'))
  return poaches.filter((p) => pids.includes(p.pid))
}

export function getPoachPlayersForCurrentTeam(state) {
  const poaches = getPoachesForCurrentLeague(state)
  const { teamId } = getApp(state)

  const poachPlayers = []
  for (const poach of poaches.valueSeq()) {
    if (poach.tid !== teamId) continue
    const pid = poach.pid
    const playerMap = getPlayerById(state, { pid })
    poachPlayers.push(poach.set('playerMap', playerMap))
  }

  return new List(poachPlayers)
}

export function getPoachPlayersForCurrentLeague(state) {
  let poaches = getPoachesForCurrentLeague(state)

  for (const poach of poaches.values()) {
    const pid = poach.pid
    const playerMap = getPlayerById(state, { pid })

    const slot = playerMap.get('slot')
    if (slot !== constants.slots.PS && slot !== constants.slots.PSR) {
      poaches = poaches.delete(pid)
      continue
    }

    poaches = poaches.setIn([pid, 'playerMap'], playerMap)
    if (poach.release.size) {
      const releases = []
      for (const pid of poach.release) {
        const playerMap = getPlayerById(state, { pid })
        releases.push(playerMap)
      }
      poaches = poaches.setIn([pid, 'release'], new List(releases))
    }
  }

  return poaches.valueSeq().toList()
}
