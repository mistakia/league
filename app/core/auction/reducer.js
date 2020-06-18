import { Record, List, Map } from 'immutable'

import { auctionActions } from './actions'

const initialState = new Record({
  isPaused: true,
  player: null,
  bid: null,
  tids: new List(),
  transactions: new Map()
})

export function auctionReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case auctionActions.AUCTION_START:
      return state.merge({
        isPaused: false
      })

    case auctionActions.AUCTION_BID:
      const { bid, player } = payload
      return state.merge({
        isPaused: false,
        bid,
        player
      })

    case auctionActions.AUCTION_PROCESSED:
      return state.merge({
        isPaused: false,
        transactions: state.transactions.set(payload.uid, payload)
      })

    case auctionActions.AUCTION_PAUSED:
      return state.merge({
        isPaused: true
      })

    case auctionActions.AUCTION_INIT:
      return state.withMutations(state => {
        payload.transactions.forEach(t => state.transactions.set(t.uid, t))
        state.set('tids', new List(payload.tids))
      })

    default:
      return state
  }
}
