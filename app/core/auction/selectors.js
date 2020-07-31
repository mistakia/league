import { createSelector } from 'reselect'

import { constants } from '@common'
import { fuzzySearch } from '@core/utils'

export function getAuction (state) {
  return state.get('auction')
}

export function isTeamConnected (state, { tid }) {
  const { connected } = getAuction(state)
  return connected.includes(tid)
}

export function getAuctionPlayers (state) {
  const auction = state.get('auction')
  const players = state.get('players').get('items')
  const search = auction.get('search')
  const positions = auction.get('positions')
  let filtered = players

  if (positions.size !== constants.positions.length) {
    filtered = players.filter(player => positions.includes(player.pos1))
  }

  if (search) {
    filtered = filtered.filter(player => fuzzySearch(search, player.name))
  }

  return filtered
}

export function getAuctionPosition (state) {
  const transactions = state.get('auction').get('transactions')
  const processed = transactions.filter(t => t.type === constants.transactions.AUCTION_PROCESSED)
  return processed.size
}

export function getNominatingTeamId (state) {
  const position = getAuctionPosition(state)
  const tids = state.get('auction').get('tids')
  return tids.get(position % tids.size)
}

export const getPlayersForOptimalLineup = createSelector(
  (state) => state.get('players'),
  getAuction,
  (players, auction) => {
    return auction.lineupPlayers.map(playerId => players.get('items').get(playerId))
  }
)
