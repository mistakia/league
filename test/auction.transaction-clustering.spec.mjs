/* global describe it */
import * as chai from 'chai'

import cluster_auction_transactions from '@core/auction/cluster-auction-transactions.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// The auction side rail's `All` view groups the log into one block per player
// auction, and every rule that grouping follows is invisible from a single row.
//
// A block auction runs several players at once, so their rows INTERLEAVE and a
// contiguous-run grouping would cut each auction into as many pieces as it has
// interruptions. An unsold player is nominated again later, and that is a
// SECOND auction rather than more rows on the first. And the log the client
// holds is a WINDOW, so the oldest cluster in it routinely opens on a bid whose
// nomination is off the end.
//
// NO DATABASE and no rendering: the grouping is pure, and it takes rows already
// classified, so this drives it with the shape the connector builds.
describe('auction transaction clustering', function () {
  // Rows arrive newest first, the order the client holds them in. `key` is
  // whatever the connector minted; the grouping only has to preserve it.
  const row = (kind, pid, tid, player_salary) => ({
    kind,
    key: `${kind}-${pid}-${tid}-${player_salary}`,
    transaction: { pid, tid, player_salary }
  })

  it('groups one auction from its nomination, bids and sale', function () {
    const rows = [
      row('processed', 'PLAY-ERON-000001', 2, 12),
      row('bid', 'PLAY-ERON-000001', 2, 12),
      row('bid', 'PLAY-ERON-000001', 3, 10),
      row('nomination', 'PLAY-ERON-000001', 1, 5)
    ]

    const auctions = cluster_auction_transactions(rows)

    expect(auctions.length).to.equal(1)
    expect(auctions[0].pid).to.equal('PLAY-ERON-000001')
    expect(auctions[0].sale.transaction.player_salary).to.equal(12)
    expect(auctions[0].nomination.transaction.tid).to.equal(1)
    // Newest first inside the cluster, the same order the flat list is in.
    expect(auctions[0].bids.map((bid) => bid.transaction.player_salary)).to.eql(
      [12, 10]
    )
  })

  it('summarises each team at the most it offered, highest first', function () {
    // Team 2 bid three times and team 3 twice; the panel names each team once.
    const rows = [
      row('processed', 'PLAY-ERON-000001', 2, 18),
      row('bid', 'PLAY-ERON-000001', 2, 18),
      row('bid', 'PLAY-ERON-000001', 3, 16),
      row('bid', 'PLAY-ERON-000001', 2, 12),
      row('bid', 'PLAY-ERON-000001', 3, 10),
      row('nomination', 'PLAY-ERON-000001', 2, 5)
    ]

    const auctions = cluster_auction_transactions(rows)

    expect(auctions[0].team_bids).to.eql([
      { tid: 2, amount: 18 },
      { tid: 3, amount: 16 }
    ])
  })

  it('counts the sale price toward the winning team', function () {
    // An election-mode sale carries the price and the winner and arrives with
    // no bid of its own behind it.
    const rows = [
      row('processed', 'PLAY-ERON-000001', 3, 40),
      row('bid', 'PLAY-ERON-000001', 2, 12),
      row('nomination', 'PLAY-ERON-000001', 2, 5)
    ]

    const auctions = cluster_auction_transactions(rows)

    expect(auctions[0].team_bids).to.eql([
      { tid: 3, amount: 40 },
      { tid: 2, amount: 12 }
    ])
  })

  it('keeps two interleaved auctions apart', function () {
    const rows = [
      row('bid', 'PLAY-ERTW-000002', 4, 20),
      row('bid', 'PLAY-ERON-000001', 3, 11),
      row('nomination', 'PLAY-ERTW-000002', 2, 15),
      row('bid', 'PLAY-ERON-000001', 2, 9),
      row('nomination', 'PLAY-ERON-000001', 1, 5)
    ]

    const auctions = cluster_auction_transactions(rows)

    expect(auctions.length).to.equal(2)
    expect(auctions.map((auction) => auction.pid)).to.eql([
      'PLAY-ERTW-000002',
      'PLAY-ERON-000001'
    ])
    expect(auctions[1].bids.length).to.equal(2)
  })

  it('orders by last activity rather than by nomination', function () {
    // The first player nominated is still taking bids after the second sold.
    const rows = [
      row('bid', 'PLAY-ERON-000001', 3, 30),
      row('processed', 'PLAY-ERTW-000002', 2, 15),
      row('nomination', 'PLAY-ERTW-000002', 2, 15),
      row('nomination', 'PLAY-ERON-000001', 1, 5)
    ]

    const auctions = cluster_auction_transactions(rows)

    expect(auctions.map((auction) => auction.pid)).to.eql([
      'PLAY-ERON-000001',
      'PLAY-ERTW-000002'
    ])
  })

  it('opens a second auction when a player is nominated again', function () {
    const rows = [
      row('bid', 'PLAY-ERON-000001', 4, 8),
      row('nomination', 'PLAY-ERON-000001', 3, 6),
      row('processed', 'PLAY-ERON-000001', 2, 5),
      row('nomination', 'PLAY-ERON-000001', 1, 5)
    ]

    const auctions = cluster_auction_transactions(rows)

    expect(auctions.length).to.equal(2)
    expect(auctions[0].sale).to.equal(null)
    expect(auctions[0].bids.length).to.equal(1)
    expect(auctions[1].sale.transaction.player_salary).to.equal(5)
    expect(auctions[1].bids.length).to.equal(0)
  })

  it('keeps a cluster whose nomination is off the end of the window', function () {
    const rows = [
      row('processed', 'PLAY-ERON-000001', 2, 12),
      row('bid', 'PLAY-ERON-000001', 2, 12)
    ]

    const auctions = cluster_auction_transactions(rows)

    expect(auctions.length).to.equal(1)
    expect(auctions[0].nomination).to.equal(null)
    expect(auctions[0].sale.transaction.player_salary).to.equal(12)
  })

  it('returns nothing for an auction with no activity', function () {
    expect(cluster_auction_transactions([])).to.eql([])
  })
})
