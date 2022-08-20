import dayjs from 'dayjs'
import { createSelector } from 'reselect'

import { getAllPlayers } from '@core/players'
import {
  getCurrentPlayers,
  getRosteredPlayerIdsForCurrentLeague,
  getActiveRosterPlayerIdsForCurrentLeague,
  isPlayerEligible
} from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { constants, getFreeAgentPeriod } from '@common'
import { fuzzySearch } from '@core/utils'

export function getAuction(state) {
  return state.get('auction')
}

export function isTeamConnected(state, { tid }) {
  const { connected } = getAuction(state)
  return connected.includes(tid)
}

export function getTeamBid(state, { tid }) {
  const auction = getAuction(state)
  const last = auction.transactions.first()
  if (!last) {
    return null
  }

  const pid = last.pid
  const bid = auction.transactions.find((t) => t.pid === pid && t.tid === tid)
  return bid ? bid.value : null
}

export function getAuctionTargetPlayers(state) {
  const playerMaps = state.get('players').get('items')
  const rostered_pids = getRosteredPlayerIdsForCurrentLeague(state)
  const auction = state.get('auction')
  const search = auction.get('search')
  const currentPlayers = getCurrentPlayers(state)

  let filtered = playerMaps
  filtered = filtered.filter((pMap) => !rostered_pids.includes(pMap.get('pid')))
  for (const playerMap of currentPlayers.active) {
    const pid = playerMap.get('pid')
    if (!pid) continue
    filtered = filtered.set(pid, playerMap)
  }

  if (search) {
    filtered = filtered.filter((pMap) => fuzzySearch(search, pMap.get('name')))
  }
  return filtered.sort(
    (a, b) =>
      b.getIn(['vorp', '0'], constants.default_points_added) -
      a.getIn(['vorp', '0'], constants.default_points_added)
  )
}

export function getAuctionPosition(state) {
  const transactions = state.get('auction').get('transactions')
  const processed = transactions.filter(
    (t) => t.type === constants.transactions.AUCTION_PROCESSED
  )
  return processed.size
}

export function getAuctionInfoForPosition(state, { pos }) {
  const playerMaps = getAllPlayers(state).filter((pMap) =>
    pos ? pMap.get('pos') === pos : true
  )
  const active_pids = getActiveRosterPlayerIdsForCurrentLeague(state)
  const rostered = playerMaps.filter((pMap) =>
    active_pids.includes(pMap.get('pid'))
  )

  const totalVorp = playerMaps.reduce(
    (a, b) => a + Math.max(b.getIn(['vorp', '0']) || 0, 0),
    0
  )
  const rosteredVorp = rostered.reduce(
    (a, b) => a + Math.max(b.getIn(['vorp', '0']) || 0, 0),
    0
  )
  const retail = rostered.reduce(
    (a, b) => a + (b.getIn(['market_salary', '0']) || 0),
    0
  )
  const actual = rostered.reduce(
    (sum, playerMap) => sum + (playerMap.get('value') || 0),
    0
  )
  return {
    count: {
      total: playerMaps.size,
      rostered: rostered.size
    },
    vorp: {
      total: totalVorp,
      rostered: rosteredVorp
    },
    value: {
      retail,
      actual
    }
  }
}

export function isAfterAuction(state) {
  const league = getCurrentLeague(state)

  if (!league.adate) {
    return false
  }

  const faPeriod = getFreeAgentPeriod(league.adate)
  if (dayjs().isBefore(faPeriod.end)) {
    return false
  }

  return true
}

export function isNominatedPlayerEligible(state) {
  const auction = getAuction(state)
  return isPlayerEligible(state, { pid: auction.nominated_pid })
}

export const getPlayersForOptimalLineup = createSelector(
  (state) => state.get('players'),
  getAuction,
  (players, auction) => {
    return auction.lineupPlayers.map((pid) => players.get('items').get(pid))
  }
)
