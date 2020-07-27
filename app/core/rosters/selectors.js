import { List } from 'immutable'

import { Roster } from '@common'
import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'
import { getCurrentLeague } from '@core/leagues'

import { Roster as RosterRecord } from './roster'

export function getRosters (state) {
  return state.get('rosters')
}

export function getRosteredPlayersForCurrentLeague (state) {
  const rosters = getRosters(state)
  const { leagueId } = getApp(state)
  const leagueRosters = rosters.filter(r => r.lid === leagueId)

  const players = []
  for (const roster of leagueRosters.values()) {
    for (const [key, value] of roster.entries()) {
      if (key.startsWith('s')) {
        players.push(value)
      }
    }
  }
  return new List(players)
}

export function isPlayerAvailable (state, { player }) {
  const rostered = getRosteredPlayersForCurrentLeague(state)
  return !rostered.includes(player.player)
}

export function isPlayerEligible (state, { player, playerId }) {
  if (playerId) {
    player = getPlayerById(state, { playerId })
  }

  if (!player) {
    return false
  }
  const roster = getCurrentTeamRoster(state)
  const league = getCurrentLeague(state)
  const ros = new Roster({ roster: roster.toJS(), league })
  return ros.hasOpenBenchSlot(player.pos1)
}

export function getCurrentTeamRoster (state) {
  const rosters = getRosters(state)
  const { teamId } = getApp(state)
  const roster = rosters.get(teamId)
  return roster || new RosterRecord()
}

export function getCurrentPlayers (state) {
  const rosters = getRosters(state)
  const { teamId, leagueId } = getApp(state)
  const league = state.get('leagues').get(leagueId)
  const roster = rosters.get(teamId)
  if (!roster) {
    return { active: new List(), practice: new List() }
  }

  const r = new Roster({ roster: roster.toJS(), league })
  const activePlayerIds = r.active.map(p => p.player)
  const active = new List(activePlayerIds.map(playerId => getPlayerById(state, { playerId })))
  const practicePlayerIds = r.practice.map(p => p.player)
  const practice = new List(practicePlayerIds.map(playerId => getPlayerById(state, { playerId })))

  return { active, practice }
}
