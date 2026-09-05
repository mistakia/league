/**
 * Group classified auction rows into one cluster per player auction.
 *
 * ONE PLAYER'S AUCTION IS THE UNIT A MANAGER READS, not one row of the log. A
 * flat interleaved list answers "what happened last" and nothing else: the
 * eleven bids that decided a price are scattered among the bids on three other
 * players, and the nomination that opened it is however many rows back. Grouped,
 * the same rows answer "what did this player go for, and who was in on it" at a
 * glance, which is the question the rail exists for.
 *
 * GROUPED BY PID AGAINST AN OPEN SET, not by adjacency. Several players can be
 * open at once -- every block auction runs that way -- so their rows interleave
 * in the log and a contiguous-run grouping would cut each auction into as many
 * clusters as it has interruptions.
 *
 * A PLAYER CAN BE AUCTIONED TWICE. An unsold player is nominated again later,
 * and that is a SECOND auction rather than more rows on the first: a nomination
 * always opens a new cluster, and a sale closes the one it lands on.
 *
 * THE LOG IS A WINDOW, so a cluster may open on a bid or a sale whose
 * nomination is off the end of it. Such a cluster is real and renders with
 * `nomination` null rather than being dropped -- discarding it would hide the
 * most recent sales of any auction long enough to be worth reading.
 *
 * Walked OLDEST FIRST for the reason the classifier is: the list arrives newest
 * first, and which row opened an auction is only answerable in the order the
 * auction happened.
 *
 * @param {Array<{transaction: {pid: string}, kind: string, key: string}>} rows
 *   classified auction rows, newest first
 * `team_bids` IS THE CLUSTER'S SUMMARY, one entry per team that was in on the
 * player at the most it offered, priced highest first. A team bidding five
 * times is one entry: what a manager reads off an auction is who was in and how
 * far each went, and the four intermediate steps of one team's climb say
 * nothing the top of it does not.
 *
 * @returns {Array<{pid: string, key: string, nomination: object|null, bids:
 *   Array<object>, sale: object|null, team_bids: Array<{tid: number, amount:
 *   number}>}>} one cluster per auction, most recently active first, with
 *   `bids` newest first inside each
 */
export default function cluster_auction_transactions(rows) {
  const open_by_pid = new Map()
  const auctions = []

  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]
    const { pid } = row.transaction

    let auction = open_by_pid.get(pid)

    if (!auction || row.kind === 'nomination') {
      auction = {
        pid,
        key: row.key,
        nomination: null,
        bids: [],
        sale: null,
        team_bids: [],
        // The index of the NEWEST row in the cluster, which is what orders the
        // clusters against each other. Every later assignment is a smaller
        // index, so the last one written is the newest row the cluster has.
        newest_index: index,
        // tid -> that team's best offer so far, collapsed into `team_bids`
        // below. A Map rather than a scan of `bids` at the end, because the
        // sale carries a price too and is not in that array.
        best_by_tid: new Map()
      }
      open_by_pid.set(pid, auction)
      auctions.push(auction)
    }

    auction.newest_index = index

    const { tid, player_salary } = row.transaction
    const best = auction.best_by_tid.get(tid)
    if (!best) {
      auction.best_by_tid.set(tid, { tid, amount: player_salary })
    } else if (player_salary > best.amount) {
      best.amount = player_salary
    }

    if (row.kind === 'nomination') {
      auction.nomination = row
    } else if (row.kind === 'processed') {
      auction.sale = row
      open_by_pid.delete(pid)
    } else {
      // `unshift` rather than `push`: the walk is oldest first and a cluster
      // renders newest first, the same order the flat list is in.
      auction.bids.unshift(row)
    }
  }

  for (const auction of auctions) {
    // HIGHEST FIRST, so the head of the list is the winner on a settled auction
    // and the standing high bid on an open one -- and the rest reads as how
    // close the room got. A tie holds insertion order, which is oldest bid
    // first, so the team that reached the price is ahead of the team that
    // matched it.
    auction.team_bids = [...auction.best_by_tid.values()].sort(
      (a, b) => b.amount - a.amount
    )
    delete auction.best_by_tid
  }

  // BY LAST ACTIVITY, not by when the player was nominated. On a live board the
  // auction a manager wants at the top is the one that just moved, and a player
  // nominated first can still be taking bids after four others have sold.
  return auctions.sort((a, b) => a.newest_index - b.newest_index)
}
