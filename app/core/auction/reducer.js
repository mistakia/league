import { Record, List, Map } from 'immutable'

import { constants } from '@common'
import { auctionActions } from './actions'

const initialState = new Record({
  isPaused: true,
  selected: null,
  player: null,
  bid: null,
  tids: new List(),
  transactions: new List(),
  positions: new List(constants.positions),
  search: null
})

export function auctionReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case auctionActions.AUCTION_FILTER:
      return state.merge({ [payload.type]: new List(payload.values) })

    case auctionActions.AUCTION_START:
      return state.merge({
        isPaused: false
      })

    case auctionActions.AUCTION_SELECT_PLAYER:
      return state.merge({
        selected: payload.player,
        bid: 1,
      })

    case auctionActions.AUCTION_BID:
      return state.merge({
        selected: null,
        isPaused: false,
        transactions: state.transactions.unshift(payload),
        bid: payload.value,
        player: payload.player
      })

    case auctionActions.AUCTION_PROCESSED:
      return state.merge({
        selected: null,
        isPaused: false,
        bid: null,
        transactions: state.transactions.unshift(payload),
        player: null
      })

    case auctionActions.AUCTION_PAUSED:
      return state.merge({
        isPaused: true
      })

    case auctionActions.AUCTION_INIT:
      const latest = payload.transactions[0]
      return state.merge({
        player: (latest && latest.type === constants.transactions.AUCTION_BID) ? latest.player : null,
        transactions: new List(payload.transactions),
        tids: new List(payload.tids)
      })

    default:
      return state
  }
}
