import { transaction_types } from '#constants'

/**
 * Split the auction log into nominations, bids and sales.
 *
 * A NOMINATION IS NOT ITS OWN TRANSACTION TYPE. `_create_nomination_bid` writes
 * exactly the row `_create_bid_record` writes -- an `AUCTION_BID` at the opening
 * price -- because binding a nominator to its opening bid is what a nomination
 * does. So the distinction is positional rather than stored: the first
 * `AUCTION_BID` on a player since that player was last processed opened them,
 * and every later one is a bid against an open player.
 *
 * A PROXY STEP IS A BID and is correctly classified as one. From the log an
 * engine bid and a human bid are the same row by design; only the live socket
 * can tell them apart, in `_manual_bids`, and nothing it holds reaches a client.
 *
 * Walked OLDEST FIRST, which is why this counts down rather than mapping: the
 * list arrives newest first, and "the first bid on this player" is only
 * answerable in the order the auction actually happened.
 *
 * @param {Array<{type?: number, pid: string, tid: number}>} transactions
 *   auction transactions, newest first
 * @returns {Array<'nomination'|'bid'|'processed'>} one kind per transaction, in
 *   the order they were given
 */
export default function classify_auction_transactions(transactions) {
  const open_pids = new Set()
  const kinds = new Array(transactions.length)

  for (let index = transactions.length - 1; index >= 0; index--) {
    const transaction = transactions[index]

    if (transaction.type === transaction_types.AUCTION_PROCESSED) {
      open_pids.delete(transaction.pid)
      kinds[index] = 'processed'
    } else if (open_pids.has(transaction.pid)) {
      kinds[index] = 'bid'
    } else {
      open_pids.add(transaction.pid)
      kinds[index] = 'nomination'
    }
  }

  return kinds
}
