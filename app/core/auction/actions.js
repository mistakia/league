export const auctionActions = {
  AUCTION_JOIN: 'AUCTION_JOIN',

  AUCTION_PROCESSED: 'AUCTION_PROCESSED',
  AUCTION_BID: 'AUCTION_BID',
  AUCTION_INIT: 'AUCTION_INIT',
  AUCTION_START: 'AUCTION_START',
  AUCTION_PAUSED: 'AUCTION_PAUSED',

  AUCTION_FILTER: 'AUCTION_FILTER',

  AUCTION_SELECT_PLAYER: 'AUCTION_SELECT_PLAYER',
  AUCTION_SUBMIT_NOMINATION: 'AUCTION_SUBMIT_NOMINATION',
  AUCTION_SUBMIT_BID: 'AUCTION_SUBMIT_BID',

  filter: (type, values) => ({
    type: auctionActions.AUCTION_FILTER,
    payload: {
      type,
      values
    }
  }),

  select: (player) => ({
    type: auctionActions.AUCTION_SELECT_PLAYER,
    payload: {
      player
    }
  }),

  nominate: (value) => ({
    type: auctionActions.AUCTION_SUBMIT_NOMINATION,
    payload: {
      value
    }
  }),

  bid: (value) => ({
    type: auctionActions.AUCTION_SUBMIT_BID,
    payload: {
      value
    }
  }),

  join: () => ({
    type: auctionActions.AUCTION_JOIN
  })
}
