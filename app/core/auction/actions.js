export const auctionActions = {
  AUCTION_JOIN: 'AUCTION_JOIN',

  AUCTION_PROCESSED: 'AUCTION_PROCESSED',
  AUCTION_BID: 'AUCTION_BID',
  AUCTION_INIT: 'AUCTION_INIT',
  AUCTION_START: 'AUCTION_START',
  AUCTION_PAUSED: 'AUCTION_PAUSED',
  AUCTION_CONNECTED: 'AUCTION_CONNECTED',

  AUCTION_RELEASE_LOCK: 'AUCTION_RELEASE_LOCK',

  AUCTION_FILTER: 'AUCTION_FILTER',
  AUCTION_SEARCH_PLAYERS: 'AUCTION_SEARCH_PLAYERS',

  AUCTION_SELECT_PLAYER: 'AUCTION_SELECT_PLAYER',
  AUCTION_SUBMIT_NOMINATION: 'AUCTION_SUBMIT_NOMINATION',
  AUCTION_SUBMIT_BID: 'AUCTION_SUBMIT_BID',

  release: () => ({
    type: auctionActions.AUCTION_RELEASE_LOCK
  }),

  filter: (type, values) => ({
    type: auctionActions.AUCTION_FILTER,
    payload: {
      type,
      values
    }
  }),

  search: (value) => ({
    type: auctionActions.AUCTION_SEARCH_PLAYERS,
    payload: {
      value
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
