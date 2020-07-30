import { List } from 'immutable'
import moment from 'moment'

import { Roster, constants } from '@common'
import { getApp } from '@core/app'
import { getPlayerById } from '@core/players'
import { getCurrentLeague } from '@core/leagues'
import { getContextMenuPlayer } from '@core/context-menu'

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

export function isPracticeSquadEligible (state) {
  const player = getContextMenuPlayer(state)
  if (!player.player) {
    return false
  }

  // is a rookie
  if (player.draft_year !== constants.year) {
    return false
  }

  const { leagueId } = getApp(state)
  const league = state.get('leagues').get(leagueId)
  const rosterRec = getCurrentTeamRoster(state)
  const roster = new Roster({ roster: rosterRec.toJS(), league })
  const rosterPlayers = rosterRec.get('players')
  const rosterPlayer = rosterPlayers.find(p => p.player === player.player)

  // on active roster
  if (!roster.active.find(p => p.player === player.player)) {
    return false
  }

  // has not been on active roster for more than 48 hours
  const cutoff = moment(rosterPlayer.timestamp, 'X').add('48', 'hours')
  if (moment().isAfter(cutoff)) {
    return false
  }

  // has not been activated recently
  if (rosterPlayer.type === constants.transactions.ROSTER_ACTIVATE) {
    return false
  }

  // has space on practice squad
  if (!roster.hasOpenPracticeSquadSlot()) {
    return false
  }

  return true
}

export function isActiveRosterEligible (state) {
  const player = getContextMenuPlayer(state)
  if (!player.player) {
    return false
  }

  const { leagueId } = getApp(state)
  const league = state.get('leagues').get(leagueId)
  const rosterRec = getCurrentTeamRoster(state)
  const roster = new Roster({ roster: rosterRec.toJS(), league })

  // on practice squad
  if (!roster.practice.find(p => p.player === player.player)) {
    return false
  }

  // team has open bench slot
  if (!roster.hasOpenBenchSlot(player.pos1)) {
    return false
  }

  return true
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
