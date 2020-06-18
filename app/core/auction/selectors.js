import { constants } from '@common'

export function getAuction (state) {
  return state.get('auction')
}

export function getAuctionPlayers (state) {
  const auction = state.get('auction')
  const players = state.get('players').get('items')
  const positions = auction.get('positions')
  let filtered = players

  if (positions.size !== constants.positions.length) {
    filtered = players.filter(player => positions.includes(player.pos1))
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
