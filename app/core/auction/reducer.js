import { Record, List } from 'immutable'

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
  bidTimer: null,
  nominationTimer: null,
  search: null,
  timer: null
})

export function auctionReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case auctionActions.AUCTION_FILTER:
      return state.merge({ [payload.type]: new List(payload.values) })

    case auctionActions.AUCTION_START: {
      const latest = state.transactions.first()
      return state.merge({
        isPaused: false,
        timer: latest && latest.type === constants.transactions.AUCTION_BID
          ? Math.round((Date.now() + state.bidTimer) / 1000)
          : Math.round((Date.now() + state.nominationTimer) / 1000)
      })
    }

    case auctionActions.AUCTION_SELECT_PLAYER:
      return state.merge({
        selected: payload.player,
        bid: 1
      })

    case auctionActions.AUCTION_BID:
      return state.merge({
        selected: null,
        isPaused: false,
        transactions: state.transactions.unshift(payload),
        bid: payload.value,
        player: payload.player,
        timer: Math.round((Date.now() + state.bidTimer) / 1000)
      })

    case auctionActions.AUCTION_PROCESSED:
      return state.merge({
        selected: null,
        isPaused: false,
        bid: null,
        transactions: state.transactions.unshift(payload),
        player: null,
        timer: Math.round((Date.now() + state.nominationTimer) / 1000)
      })

    case auctionActions.AUCTION_PAUSED:
      return state.merge({
        isPaused: true,
        timer: null
      })

    case auctionActions.AUCTION_INIT: {
      const latest = payload.transactions[0]
      return state.merge({
        bid: (latest && latest.type === constants.transactions.AUCTION_BID) ? latest.value : null,
        player: (latest && latest.type === constants.transactions.AUCTION_BID) ? latest.player : null,
        transactions: new List(payload.transactions),
        tids: new List(payload.tids),
        bidTimer: payload.bidTimer,
        nominationTimer: payload.nominationTimer
      })
    }

    default:
      return state
  }
}
