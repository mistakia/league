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
import { getDraftPickValue } from '@core/draft-pick-value'

export function getTrade(state) {
  return state.get('trade')
}

export function getTradeIsValid(state) {
  const { teamId } = getApp(state)
  const trade = getCurrentTrade(state)
  const isProposer = trade.propose_tid === teamId

  const rosterRecord = isProposer
    ? getProposingTeamRoster(state)
    : getAcceptingTeamRoster(state)
  const add_pids = isProposer
    ? trade.acceptingTeamPlayers
    : trade.proposingTeamPlayers
  const release_pids = isProposer
    ? trade.proposingTeamReleasePlayers
    : trade.acceptingTeamReleasePlayers
  const remove_pids = isProposer
    ? trade.proposingTeamPlayers
    : trade.acceptingTeamPlayers

  const league = getCurrentLeague(state)
  const playerMaps = getAllPlayers(state)
  const roster = new Roster({ roster: rosterRecord.toJS(), league })
  release_pids.forEach((pid) => roster.removePlayer(pid))
  remove_pids.forEach((pid) => roster.removePlayer(pid))
  for (const pid of add_pids) {
    const playerMap = playerMaps.get(pid)
    const hasOpenBenchSlot = roster.hasOpenBenchSlot(playerMap.get('pos'))
    if (!hasOpenBenchSlot) {
      return false
    }
    roster.addPlayer({
      slot: constants.slots.BENCH,
      pid,
      pos: playerMap.get('pos'),
      value: playerMap.get('value')
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
    const isAcceptingTeam = trade.accept_tid === teamId
    if (isOpen && isAcceptingTeam) {
      return trade.merge({ acceptingTeamReleasePlayers: releasePlayers })
    } else {
      return trade
    }
  } else {
    const { teamId } = getApp(state)
    const accept_tid = getTradeSelectedTeamId(state)
    return createTrade({
      accept_tid,
      propose_tid: teamId,
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
    trade.acceptingTeamPlayers.map((pid) => getPlayerById(state, { pid }))
  )

  const proposingTeamPlayers = new List(
    trade.proposingTeamPlayers.map((pid) => getPlayerById(state, { pid }))
  )

  const acceptingTeamReleasePlayers = new List(
    trade.acceptingTeamReleasePlayers.map((pid) =>
      getPlayerById(state, { pid })
    )
  )

  const proposingTeamReleasePlayers = new List(
    trade.proposingTeamReleasePlayers.map((pid) =>
      getPlayerById(state, { pid })
    )
  )

  return {
    acceptingTeamPlayers,
    proposingTeamPlayers,
    acceptingTeamReleasePlayers,
    proposingTeamReleasePlayers
  }
}

function calculateTradedPicks({ picks, add, remove }) {
  const pickids = remove.map((p) => p.uid)

  let filtered = picks.filter((pick) => !pickids.includes(pick.uid))
  for (const pick of add) {
    filtered = filtered.push(pick)
  }

  return filtered
}

export function getProposingTeamTradedPicks(state) {
  const trade = getCurrentTrade(state)
  const team = getTeamById(state, { tid: trade.propose_tid })

  return calculateTradedPicks({
    picks: team.picks,
    add: trade.acceptingTeamPicks,
    remove: trade.proposingTeamPicks
  })
}

export function getAcceptingTeamTradedPicks(state) {
  const trade = getCurrentTrade(state)
  const team = getTeamById(state, { tid: trade.accept_tid })

  return calculateTradedPicks({
    picks: team.picks,
    add: trade.proposingTeamPicks,
    remove: trade.acceptingTeamPicks
  })
}

function calculateTradedRosterPlayers({ state, roster, add, remove, release }) {
  const active_pids = roster.active.map((p) => p.pid)

  const remove_pids = []
  remove.forEach((pid) => remove_pids.push(pid))
  release.forEach((pid) => remove_pids.push(pid))

  const filtered_pids = active_pids.filter((pid) => !remove_pids.includes(pid))
  add.forEach((pid) => filtered_pids.push(pid))

  return filtered_pids.map((pid) => getPlayerById(state, { pid }))
}

export function getProposingTeamTradedRosterPlayers(state) {
  const trade = getCurrentTrade(state)
  const roster = getRosterByTeamId(state, { tid: trade.propose_tid })

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
  const roster = getRosterByTeamId(state, { tid: trade.accept_tid })

  return calculateTradedRosterPlayers({
    state,
    roster,
    add: trade.proposingTeamPlayers,
    release: trade.acceptingTeamReleasePlayers,
    remove: trade.acceptingTeamPlayers
  })
}

function getTeamTradeSummary(state, { lineups, playerMaps, picks }) {
  const vorpType = constants.isOffseason ? '0' : 'ros'
  const draft_value = picks.reduce(
    (sum, pick) => sum + getDraftPickValue(state, { ...pick }),
    0
  )
  const player_value = playerMaps.reduce(
    (sum, pMap) => sum + Math.max(pMap.getIn(['vorp', vorpType]), 0),
    0
  )
  const values = {
    points: lineups.reduce((sum, l) => sum + l.baseline_total, 0),
    value: player_value + draft_value,
    player_value,
    draft_value,
    value_adj: playerMaps.reduce(
      (sum, pMap) => sum + Math.max(pMap.getIn(['vorp_adj', vorpType]), 0),
      0
    ),
    salary: playerMaps.reduce((sum, pMap) => sum + pMap.get('value', 0), 0)
  }

  return values
}

export function getCurrentTradeAnalysis(state) {
  const trade = getCurrentTrade(state)

  const proposingTeamRoster = getRosterRecordByTeamId(state, {
    tid: trade.propose_tid
  })
  const acceptingTeamRoster = getRosterRecordByTeamId(state, {
    tid: trade.accept_tid
  })

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

  const proposingTeamTradedPicks = getProposingTeamTradedPicks(state)
  const acceptingTeamTradedPicks = getAcceptingTeamTradedPicks(state)

  const proposingTeamTradedPlayers = getProposingTeamTradedRosterPlayers(state)
  const acceptingTeamTradedPlayers = getAcceptingTeamTradedRosterPlayers(state)

  const proposingTeamPlayers = getActivePlayersByTeamId(state, {
    tid: trade.propose_tid
  })
  const acceptingTeamPlayers = getActivePlayersByTeamId(state, {
    tid: trade.accept_tid
  })

  const proposingTeamRecord = getTeamById(state, { tid: trade.propose_tid })
  const proposingTeam = {
    team: proposingTeamRecord,
    before: getTeamTradeSummary(state, {
      lineups: proposingTeamLineups,
      playerMaps: proposingTeamPlayers,
      picks: proposingTeamRecord.picks
    }),
    after: getTeamTradeSummary(state, {
      lineups: proposingTeamProjectedLineups,
      playerMaps: proposingTeamTradedPlayers,
      picks: proposingTeamTradedPicks
    })
  }

  const acceptingTeamRecord = getTeamById(state, { tid: trade.accept_tid })
  const acceptingTeam = {
    team: acceptingTeamRecord,
    before: getTeamTradeSummary(state, {
      lineups: acceptingTeamLineups,
      playerMaps: acceptingTeamPlayers,
      picks: acceptingTeamRecord.picks
    }),
    after: getTeamTradeSummary(state, {
      lineups: acceptingTeamProjectedLineups,
      playerMaps: acceptingTeamTradedPlayers,
      picks: acceptingTeamTradedPicks
    })
  }

  return { proposingTeam, acceptingTeam }
}

export function getProposingTeamPlayers(state) {
  const trade = getCurrentTrade(state)
  return getPlayersByTeamId(state, { tid: trade.propose_tid })
}

export function getAcceptingTeamPlayers(state) {
  const trade = getCurrentTrade(state)
  return getPlayersByTeamId(state, { tid: trade.accept_tid })
}

export function getProposingTeam(state) {
  const trade = getCurrentTrade(state)
  return getTeamById(state, { tid: trade.propose_tid })
}

export function getAcceptingTeam(state) {
  const trade = getCurrentTrade(state)
  return getTeamById(state, { tid: trade.accept_tid })
}

export function getProposingTeamRoster(state) {
  const trade = getCurrentTrade(state)
  return getRosterRecordByTeamId(state, { tid: trade.propose_tid })
}

export function getAcceptingTeamRoster(state) {
  const trade = getCurrentTrade(state)
  return getRosterRecordByTeamId(state, { tid: trade.accept_tid })
}
