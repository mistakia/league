import dayjs from 'dayjs'
import { Set } from 'immutable'
import { createSelector } from 'reselect'

import { getPlayersForWatchlist, getAllPlayers } from '@core/players'
import {
  getRosteredPlayerIdsForCurrentLeague,
  getCurrentPlayers,
  getActiveRosterPlayerIdsForCurrentLeague
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

  const player = last.player
  const bid = auction.transactions.find(
    (t) => t.player === player && t.tid === tid
  )
  return bid ? bid.value : null
}

export function getAuctionTargetPlayers(state) {
  const { valueType, hideRostered } = getAuction(state)
  const watchlistPlayers = getPlayersForWatchlist(state)
  const optimalPlayers = getPlayersForOptimalLineup(state)
  const rosteredPlayerIds = getRosteredPlayerIdsForCurrentLeague(state)
  const currentPlayers = getCurrentPlayers(state)

  let combined = Set(watchlistPlayers).union(Set(optimalPlayers))
  if (hideRostered) {
    combined = combined.filter((p) => !rosteredPlayerIds.includes(p.player))
  }
  const players = combined.union(Set(currentPlayers.active))
  return players.sort(
    (a, b) => b.getIn(['vorp', valueType], 0) - a.getIn(['vorp', valueType], 0)
  )
}

export function getAuctionPlayers(state) {
  const auction = state.get('auction')
  const players = state.get('players').get('items')
  const search = auction.get('search')
  const positions = auction.get('positions')
  let filtered = players

  if (auction.hideRostered) {
    const rostered = getRosteredPlayerIdsForCurrentLeague(state)
    filtered = filtered.filter((player) => !rostered.includes(player.player))
  }

  if (positions.size !== constants.positions.length) {
    filtered = filtered.filter((player) => positions.includes(player.pos))
  }

  if (search) {
    filtered = filtered.filter((player) => fuzzySearch(search, player.name))
  }

  return filtered
}

export function getAuctionPosition(state) {
  const transactions = state.get('auction').get('transactions')
  const processed = transactions.filter(
    (t) => t.type === constants.transactions.AUCTION_PROCESSED
  )
  return processed.size
}

export function getAuctionInfoForPosition(state, { pos }) {
  const { valueType } = getAuction(state)
  const all = getAllPlayers(state)
  const players = all.filter((p) => p.pos === pos)
  const activePlayerIds = getActiveRosterPlayerIdsForCurrentLeague(state)
  const rostered = players.filter((p) => activePlayerIds.includes(p.player))

  const totalVorp = players.reduce(
    (a, b) => a + Math.max(b.getIn(['vorp', valueType]) || 0, 0),
    0
  )
  const rosteredVorp = rostered.reduce(
    (a, b) => a + Math.max(b.getIn(['vorp', valueType]) || 0, 0),
    0
  )
  const retail = rostered.reduce(
    (a, b) => a + (b.getIn(['market_salary', valueType]) || 0),
    0
  )
  const actual = rostered.reduce((a, b) => a + (b.value || 0), 0)
  return {
    count: {
      total: players.size,
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

export const getPlayersForOptimalLineup = createSelector(
  (state) => state.get('players'),
  getAuction,
  (players, auction) => {
    return auction.lineupPlayers.map((playerId) =>
      players.get('items').get(playerId)
    )
  }
)
