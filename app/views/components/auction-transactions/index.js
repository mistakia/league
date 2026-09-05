import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state } from '@core/selectors'
import classify_auction_transactions from '@core/auction/classify-auction-transactions.mjs'

import AuctionTransactions from './auction-transactions'

const get_auction_transactions = createSelector(
  get_auction_state,
  (auction) => auction.transactions
)

// Memoized on the transaction LIST rather than on the auction slice, so it does
// not re-run on an unrelated auction store change -- a clock tick, a connection
// flip, a selected player. The rule itself lives in
// `classify-auction-transactions.mjs`, where a spec can drive it.
const get_classified_auction_transactions = createSelector(
  get_auction_transactions,
  (transactions) => {
    const rows = transactions.toArray()
    const kinds = classify_auction_transactions(rows)

    return rows.map((transaction, index) => ({
      transaction,
      kind: kinds[index],
      // An election-mode sale reaches the client as a broadcast payload with no
      // `transaction_id` on it, so the row's own position carries the key for
      // that one case.
      key: transaction.transaction_id
        ? `transaction-${transaction.transaction_id}`
        : `${kinds[index]}-${transaction.pid}-${transaction.tid}-${index}`
    }))
  }
)

const map_state_to_props = createSelector(
  get_classified_auction_transactions,
  (transactions) => ({ transactions })
)

export default connect(map_state_to_props)(AuctionTransactions)
