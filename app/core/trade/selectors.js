import { Map, List } from 'immutable'

import { getApp } from '@core/app'
import {
  getRosterRecordByTeamId,
  getRosterByTeamId,
  getPlayersByTeamId,
  getActivePlayersByTeamId
} from '@core/rosters'
import { getCurrentLeague, getCurrentLeagueTeamIds } from '@core/leagues'
import { getTeamById, getDraftPickById } from '@core/teams'
import { createTrade } from './trade'
import { Roster, constants } from '@common'
import { getAllPlayers, getPlayerById } from '@core/players'

export function getTrade(state) {
  return state.get('trade')
}

export function getTradeIsValid(state) {
  const { teamId } = getApp(state)
  const trade = getCurrentTrade(state)
  const isProposer = trade.pid === teamId

  const rosterRecord = isProposer
    ? getProposingTeamRoster(state)
    : getAcceptingTeamRoster(state)
  const addPlayerIds = isProposer
    ? trade.acceptingTeamPlayers
    : trade.proposingTeamPlayers
  const releasePlayerIds = isProposer
    ? trade.proposingTeamReleasePlayers
    : trade.acceptingTeamReleasePlayers
  const removePlayerIds = isProposer
    ? trade.proposingTeamPlayers
    : trade.acceptingTeamPlayers

  const league = getCurrentLeague(state)
  const players = getAllPlayers(state)
  const roster = new Roster({ roster: rosterRecord.toJS(), league })
  releasePlayerIds.forEach((p) => roster.removePlayer(p))
  removePlayerIds.forEach((p) => roster.removePlayer(p))
  for (const playerId of addPlayerIds) {
    const player = players.get(playerId)
    const hasOpenBenchSlot = roster.hasOpenBenchSlot(player.pos)
    if (!hasOpenBenchSlot) {
      return false
    }
    roster.addPlayer({
      slot: constants.slots.BENCH,
      player: playerId,
      pos: player.pos,
      value: player.value
    })
  }

  return true
}

export function getTradeSelectedTeamId(state) {
  let { teamId } = getTrade(state)
  if (!teamId) {
    const myTeamId = getApp(state).teamId
    teamId = getCurrentLeagueTeamIds(state).find(
      (teamId) => teamId !== myTeamId
    )
  }

  return teamId
}

export function getCurrentTrade(state) {
  const { teamId } = getApp(state)
  const {
    selectedTradeId,
    items,
    proposingTeamPlayers,
    acceptingTeamPlayers,
    acceptingTeamPicks,
    proposingTeamPicks,
    releasePlayers
  } = getTrade(state)

  if (selectedTradeId) {
    const trade = items.get(selectedTradeId)
    const isOpen =
      !trade.cancelled && !trade.rejected && !trade.accepted && !trade.vetoed
    const isAcceptingTeam = trade.tid === teamId
    if (isOpen && isAcceptingTeam) {
      return trade.merge({ acceptingTeamReleasePlayers: releasePlayers })
    } else {
      return trade
    }
  } else {
    const { teamId } = getApp(state)
    const tid = getTradeSelectedTeamId(state)
    return createTrade({
      tid,
      pid: teamId,
      proposingTeamReleasePlayers: releasePlayers,
      acceptingTeamPlayers,
      proposingTeamPlayers,
      acceptingTeamPicks: acceptingTeamPicks.map((pickId) =>
        getDraftPickById(state, { pickId })
      ),
      proposingTeamPicks: proposingTeamPicks.map((pickId) =>
        getDraftPickById(state, { pickId })
      )
    })
  }
}

export function getCurrentTradePlayers(state) {
  const trade = getCurrentTrade(state)

  const acceptingTeamPlayers = new List(
    trade.acceptingTeamPlayers.map((playerId) =>
      getPlayerById(state, { playerId })
    )
  )

  const proposingTeamPlayers = new List(
    trade.proposingTeamPlayers.map((playerId) =>
      getPlayerById(state, { playerId })
    )
  )

  const acceptingTeamReleasePlayers = new List(
    trade.acceptingTeamReleasePlayers.map((playerId) =>
      getPlayerById(state, { playerId })
    )
  )

  const proposingTeamReleasePlayers = new List(
    trade.proposingTeamReleasePlayers.map((playerId) =>
      getPlayerById(state, { playerId })
    )
  )

  return {
    acceptingTeamPlayers,
    proposingTeamPlayers,
    acceptingTeamReleasePlayers,
    proposingTeamReleasePlayers
  }
}

function calculateTradedRosterPlayers({ state, roster, add, remove, release }) {
  const activePlayerIds = roster.active.map((p) => p.player)

  const removePlayers = []
  remove.forEach((playerId) => removePlayers.push(playerId))
  release.forEach((playerId) => removePlayers.push(playerId))

  const filteredPlayerIds = activePlayerIds.filter(
    (p) => !removePlayers.includes(p)
  )
  add.forEach((playerId) => filteredPlayerIds.push(playerId))

  return filteredPlayerIds.map((playerId) => getPlayerById(state, { playerId }))
}

export function getProposingTeamTradedRosterPlayers(state) {
  const trade = getCurrentTrade(state)
  const roster = getRosterByTeamId(state, { tid: trade.pid })

  return calculateTradedRosterPlayers({
    state,
    roster,
    add: trade.acceptingTeamPlayers,
    release: trade.proposingTeamReleasePlayers,
    remove: trade.proposingTeamPlayers
  })
}

export function getAcceptingTeamTradedRosterPlayers(state) {
  const trade = getCurrentTrade(state)
  const roster = getRosterByTeamId(state, { tid: trade.tid })

  return calculateTradedRosterPlayers({
    state,
    roster,
    add: trade.proposingTeamPlayers,
    release: trade.acceptingTeamReleasePlayers,
    remove: trade.acceptingTeamPlayers
  })
}

function getTeamTradeSummary(lineups, players) {
  const values = {
    points: lineups.reduce((sum, l) => sum + l.total, 0),
    value: players.reduce(
      (sum, p) => sum + Math.max(p.getIn(['vorp', 'ros', 'default']), 0),
      0
    ),
    value_adj: players.reduce(
      (sum, p) => sum + Math.max(p.getIn(['vorp_adj', 'ros', 'default']), 0),
      0
    ),
    salary: players.reduce((sum, p) => sum + p.value, 0)
  }

  return values
}

export function getCurrentTradeAnalysis(state) {
  const trade = getCurrentTrade(state)

  const proposingTeamRoster = getRosterRecordByTeamId(state, { tid: trade.pid })
  const acceptingTeamRoster = getRosterRecordByTeamId(state, { tid: trade.tid })

  const proposingTeamLineups = proposingTeamRoster
    .get('lineups', new Map())
    .valueSeq()
    .toArray()
  const acceptingTeamLineups = acceptingTeamRoster
    .get('lineups', new Map())
    .valueSeq()
    .toArray()

  const proposingTeamProjectedLineups = state
    .getIn(['trade', 'proposingTeamLineups'], new Map())
    .valueSeq()
    .toArray()
  const acceptingTeamProjectedLineups = state
    .getIn(['trade', 'acceptingTeamLineups'], new Map())
    .valueSeq()
    .toArray()

  const proposingTeamTradedPlayers = getProposingTeamTradedRosterPlayers(state)
  const acceptingTeamTradedPlayers = getAcceptingTeamTradedRosterPlayers(state)

  const proposingTeamPlayers = getActivePlayersByTeamId(state, {
    tid: trade.pid
  })
  const acceptingTeamPlayers = getActivePlayersByTeamId(state, {
    tid: trade.tid
  })

  const proposingTeam = {
    team: getTeamById(state, { tid: trade.pid }),
    before: getTeamTradeSummary(proposingTeamLineups, proposingTeamPlayers),
    after: getTeamTradeSummary(
      proposingTeamProjectedLineups,
      proposingTeamTradedPlayers
    )
  }

  const acceptingTeam = {
    team: getTeamById(state, { tid: trade.tid }),
    before: getTeamTradeSummary(acceptingTeamLineups, acceptingTeamPlayers),
    after: getTeamTradeSummary(
      acceptingTeamProjectedLineups,
      acceptingTeamTradedPlayers
    )
  }

  return { proposingTeam, acceptingTeam }
}

export function getProposingTeamPlayers(state) {
  const trade = getCurrentTrade(state)
  return getPlayersByTeamId(state, { tid: trade.pid })
}

export function getAcceptingTeamPlayers(state) {
  const trade = getCurrentTrade(state)
  return getPlayersByTeamId(state, { tid: trade.tid })
}

export function getProposingTeam(state) {
  const trade = getCurrentTrade(state)
  return getTeamById(state, { tid: trade.pid })
}

export function getAcceptingTeam(state) {
  const trade = getCurrentTrade(state)
  return getTeamById(state, { tid: trade.tid })
}

export function getProposingTeamRoster(state) {
  const trade = getCurrentTrade(state)
  return getRosterRecordByTeamId(state, { tid: trade.pid })
}

export function getAcceptingTeamRoster(state) {
  const trade = getCurrentTrade(state)
  return getRosterRecordByTeamId(state, { tid: trade.tid })
}
