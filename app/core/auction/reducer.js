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
      const latest = payload.transactions[0]
      return state.merge({
        isPaused: false,
        timer: latest && latest.type === constants.transactions.AUCTION_BID
          ? Math.round(Date.now() / 1000) + state.bidTimer
          : Math.round(Date.now() / 1000) + state.nominationTimer
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
        timer: Math.round(Date.now() / 1000) + state.bidTimer
      })

    case auctionActions.AUCTION_PROCESSED:
      return state.merge({
        selected: null,
        isPaused: false,
        bid: null,
        transactions: state.transactions.unshift(payload),
        player: null,
        timer: Math.round(Date.now() / 1000) + state.nominationTimer
      })

    case auctionActions.AUCTION_PAUSED:
      return state.merge({
        isPaused: true,
        timer: null
      })

    case auctionActions.AUCTION_INIT: {
      const latest = payload.transactions[0]
      return state.merge({
        player: (latest && latest.type === constants.transactions.AUCTION_BID) ? latest.player : null,
        transactions: new List(payload.transactions),
        tids: new List(payload.tids),
        bidTimer: null,
        nominationTimer: null
      })
    }

    default:
      return state
  }
}
