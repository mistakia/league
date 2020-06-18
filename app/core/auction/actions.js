export const auctionActions = {
  AUCTION_JOIN: 'AUCTION_JOIN',

  AUCTION_PROCESSED: 'AUCTION_PROCESSED',
  AUCTION_BID: 'AUCTION_BID',
  AUCTION_INIT: 'AUCTION_INIT',

  join: () => ({
    type: auctionActions.AUCTION_JOIN,
  })
}
