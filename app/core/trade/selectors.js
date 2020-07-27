import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getRosters, getCurrentTeamRoster, Roster as RosterRecord } from '@core/rosters'
import { getCurrentLeague, getCurrentLeagueTeamIds } from '@core/leagues'
import { getTeams, Team } from '@core/teams'
import { createTrade } from './trade'
import { Roster, constants } from '@common'
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
  let proposingTeamPlayers
  let acceptingTeamPlayers
  if (isProposer) {
    proposingTeamPlayers = trade.proposingTeamPlayers.toJS()
    acceptingTeamPlayers = trade.acceptingTeamPlayers.toJS()
  } else {
    acceptingTeamPlayers = trade.proposingTeamPlayers.toJS()
    proposingTeamPlayers = trade.acceptingTeamPlayers.toJS()
  }
  const roster = new Roster({ roster: rosterRecord.toJS(), league })
  dropPlayersTrade.forEach(p => roster.removePlayer(p))
  dropPlayersState.forEach(p => roster.removePlayer(p))
  proposingTeamPlayers.forEach(p => roster.removePlayer(p))
  for (const playerId of acceptingTeamPlayers) {
    const player = players.get(playerId)
    const hasOpenBenchSlot = roster.hasOpenBenchSlot(player.pos1)
    if (!hasOpenBenchSlot) {
      return false
    }
    roster.addPlayer({ slot: constants.slots.BENCH, player: playerId, pos: player.pos1 })
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
    proposingTeamPlayers,
    acceptingTeamPlayers,
    acceptingTeamPicks,
    proposingTeamPicks,
    dropPlayers
  } = getTrade(state)

  if (selectedTradeId) {
    return items.get(selectedTradeId)
  } else {
    const { teamId } = getApp(state)
    return createTrade({
      pid: teamId,
      dropPlayers,
      acceptingTeamPlayers,
      proposingTeamPlayers,
      acceptingTeamPicks,
      proposingTeamPicks
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
