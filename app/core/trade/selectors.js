import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getRosters, getCurrentTeamRoster, Roster as RosterRecord } from '@core/rosters'
import { getCurrentLeague, getCurrentLeagueTeamIds } from '@core/leagues'
import { getTeams, Team } from '@core/teams'
import { createTrade } from './trade'
import { Roster, getEligibleSlots } from '@common'
import { getAllPlayers } from '@core/players'

export function getTrade (state) {
  return state.get('trade')
}

export function getTradeIsValid (state) {
  const { teamId } = getApp(state)
  const league = getCurrentLeague(state)
  const players = getAllPlayers(state)
  const rosterRecord = getCurrentTeamRoster(state)
  const trade = getCurrentTrade(state)
  const isProposer = trade.uid ? trade.pid === teamId : true
  const dropPlayersTrade = trade.dropPlayers.toJS()
  const dropPlayersState = getTrade(state).dropPlayers.toJS()
  let sendPlayers
  let receivePlayers
  if (isProposer) {
    sendPlayers = trade.sendPlayers.toJS()
    receivePlayers = trade.receivePlayers.toJS()
  } else {
    receivePlayers = trade.sendPlayers.toJS()
    sendPlayers = trade.receivePlayers.toJS()
  }
  const roster = new Roster(rosterRecord.toJS())
  dropPlayersTrade.forEach(p => roster.removePlayer(p))
  dropPlayersState.forEach(p => roster.removePlayer(p))
  sendPlayers.forEach(p => roster.removePlayer(p))
  for (const playerId of receivePlayers) {
    const player = players.get(playerId)
    const eligibleSlots = getEligibleSlots({ bench: true, pos: player.pos1, league })
    const openSlots = roster.getOpenSlots(eligibleSlots)
    if (!openSlots.length) {
      return false
    }
    roster.addPlayer(openSlots[0], playerId)
  }

  return true
}

export function getTradeSelectedTeamId (state) {
  let { teamId } = getTrade(state)
  if (!teamId) {
    const myTeamId = getApp(state).teamId
    teamId = getCurrentLeagueTeamIds(state).find(teamId => teamId !== myTeamId)
  }

  return teamId
}

export function getCurrentTrade (state) {
  const {
    selectedTradeId,
    items,
    sendPlayers,
    receivePlayers,
    receivePicks,
    sendPicks,
    dropPlayers
  } = getTrade(state)

  if (selectedTradeId) {
    return items.get(selectedTradeId)
  } else {
    return createTrade({
      dropPlayers,
      receivePlayers,
      sendPlayers,
      receivePicks,
      sendPicks
    })
  }
}

export const getTradeSelectedTeam = createSelector(
  getTradeSelectedTeamId,
  getTeams,
  (teamId, teams) => teams.get(teamId) || new Team()
)

export const getTradeSelectedTeamRoster = createSelector(
  getTradeSelectedTeamId,
  getRosters,
  (teamId, rosters) => (rosters.get(teamId) || new RosterRecord())
)
