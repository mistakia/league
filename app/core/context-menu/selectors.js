import {
  getPlayerStatus,
  getPlayerById,
  isPlayerPracticeSquadEligible
} from '@core/players'
import { Roster } from '@common'
import { getApp } from '@core/app'
import {
  getCurrentTeamRoster,
  getRosteredPlayerIdsForCurrentLeague,
  isPlayerOnPracticeSquad
} from '@core/rosters'

export function getContextMenuInfo (state) {
  return state.get('contextMenu').toJS()
}

export function getContextMenuPlayer (state) {
  const playerId = state.getIn(['contextMenu', 'data', 'playerId'])
  return getPlayerById(state, { playerId })
}

export function getPlayerStatusCM (state) {
  const player = getContextMenuPlayer(state)
  return getPlayerStatus(state, { player })
}

export function isPlayerPracticeSquadEligibleCM (state) {
  const player = getContextMenuPlayer(state)
  if (!player.player) {
    return false
  }

  return isPlayerPracticeSquadEligible(state, { player })
}

export function isPlayerOnPracticeSquadCM (state) {
  const player = getContextMenuPlayer(state)
  if (!player.player) {
    return false
  }

  return isPlayerOnPracticeSquad(state, { player })
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

export function isPlayerRostered (state) {
  const player = getContextMenuPlayer(state)
  if (!player.player) {
    return false
  }

  const rosteredPlayerIds = getRosteredPlayerIdsForCurrentLeague(state)
  return rosteredPlayerIds.includes(player.player)
}
