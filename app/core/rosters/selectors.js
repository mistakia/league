import { List } from 'immutable'

import { Roster, constants } from '@common'
import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'
import { getCurrentLeague } from '@core/leagues'

import { Roster as RosterRecord } from './roster'

export function getRosters (state) {
  return state.get('rosters')
}

export function getRostersForCurrentLeague (state) {
  const rosters = getRosters(state)
  const { leagueId } = getApp(state)
  return rosters.filter(r => r.lid === leagueId)
}

export function getRosteredPlayerIdsForCurrentLeague (state) {
  const rosters = getRostersForCurrentLeague(state)
  const players = []
  for (const roster of rosters.values()) {
    roster.players.forEach(p => players.push(p.player))
  }
  return new List(players)
}

export function getActiveRosterPlayerIdsForCurrentLeague (state) {
  const rosters = getRostersForCurrentLeague(state)
  const players = []
  for (const roster of rosters.values()) {
    roster.players.forEach(p => {
      if (p.slot !== constants.slots.IR ||
        p.slot !== constants.slots.PS) {
        players.push(p.player)
      }
    })
  }
  return new List(players)
}

export function getPracticeSquadPlayerIdsForCurrentLeague (state) {
  const rosters = getRostersForCurrentLeague(state)
  const players = []
  for (const roster of rosters.values()) {
    roster.players.forEach(p => {
      if (p.slot === constants.slots.PS) {
        players.push(p.player)
      }
    })
  }
  return new List(players)
}

export function getInjuredReservePlayerIdsForCurrentLeague (state) {
  const rosters = getRostersForCurrentLeague(state)
  const players = []
  for (const roster of rosters.values()) {
    roster.players.forEach(p => {
      if (p.slot === constants.slots.IR) {
        players.push(p.player)
      }
    })
  }
  return new List(players)
}

export function isPlayerFreeAgent (state, { player }) {
  const rostered = getRosteredPlayerIdsForCurrentLeague(state)
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
