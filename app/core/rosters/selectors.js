import { List } from 'immutable'
import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'

import { Roster } from './roster'

export function getRosters (state) {
  return state.get('rosters')
}

export function getCurrentTeamRoster (state) {
  const rosters = getRosters(state)
  const { teamId } = getApp(state)
  const roster = rosters.get(teamId)
  return roster || new Roster()
}

export function getCurrentPlayers (state) {
  const rosters = getRosters(state)
  const { teamId } = getApp(state)
  const roster = rosters.get(teamId)
  if (!roster) {
    return new List()
  }

  let players = new List()

  for (const [key, value] of roster.toSeq()) {
    if (key.startsWith('s')) {
      const playerId = roster.get(key)
      const player = getPlayerById(state, { playerId })
      if (player) {
        players = players.push(player)
      }
    }
  }

  return players
}
