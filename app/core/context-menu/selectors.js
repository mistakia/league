import moment from 'moment'

import { getPlayerById } from '@core/players'
import { Roster, constants } from '@common'
import { getApp } from '@core/app'
import { getCurrentTeamRoster } from '@core/rosters'

export function getContextMenuInfo (state) {
  return state.get('contextMenu').toJS()
}

export function getContextMenuPlayer (state) {
  const playerId = state.getIn(['contextMenu', 'data', 'playerId'])
  return getPlayerById(state, { playerId })
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

export function isPlayerOnCurrentRoster (state) {
  const player = getContextMenuPlayer(state)
  if (!player.player) {
    return false
  }

  const roster = getCurrentTeamRoster(state)
  return !!roster.players.find(p => p.player === player.player)
}
