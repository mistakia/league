import React, { useMemo } from 'react'
import PropTypes from 'prop-types'

import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import Accordion from '@components/accordion'
import cluster_auction_transactions from '@core/auction/cluster-auction-transactions.mjs'
import { timeago } from '@core/utils'

import './auction-transactions.styl'

// ONE VIEW, ONE UNIT: the player auction. This panel carried four filters --
// processed, bids, nominations and all -- and each of the first three was a flat
// list of one kind of row, which is the shape a cluster replaced: a sale with no
// bidding around it, a bid with no player price beside it, a nomination that
// says nothing about what the player went on to fetch. The cluster answers all
// three at once for the player it is about, so the segmented control was four
// ways of asking for less.
//
// A full auction is one nomination and several bids per player across a few
// hundred players, and every cluster here mounts a connected `PlayerName` and a
// connected `TeamName` per bidding team. The rail is a reference surface read in
// glances rather than a ledger read to the bottom, so it shows the newest run
// and says how many auctions it is not showing.
const MAX_VISIBLE_AUCTIONS = 20

// The teams a cluster names before it stops counting them out. Four fits the
// meta line at 320px; past that the count of the rest is the useful part, since
// the auctions with a long tail of bidders are exactly the ones where the top
// four are what a manager wanted.
const MAX_VISIBLE_TEAM_BIDS = 4

const format_age = (occurred_at) =>
  occurred_at ? timeago.format(new Date(occurred_at), 'league_short') : ''

export default function AuctionTransactions({ transactions }) {
  const auctions = useMemo(
    () => cluster_auction_transactions(transactions),
    [transactions]
  )

  const visible = auctions.slice(0, MAX_VISIBLE_AUCTIONS)

  // ONE PLAYER'S AUCTION AS TWO LINES: the name and the price it stands at,
  // then who bid what on the line under it.
  //
  // THE NAME GETS THE WHOLE WIDTH, and that is the point of the shape. Every
  // arrangement that put the team, the state and the age on the SAME line as
  // the name was competing for a 320px rail with about 250px of usable width,
  // and the name -- the one field a manager is scanning for -- is what lost:
  // three or four short fixed columns left it under 120px and cut most names
  // mid-surname. Stacked, it has the line to itself minus the price, which is
  // the only figure that has to sit beside it.
  //
  // ONE ENTRY PER TEAM, NOT PER BID. Printing every bid was tried and it is the
  // harder read: a contested player became six near-identical lines of team and
  // dollar amount and three auctions filled the scroller, while the question a
  // manager is asking -- who was in on this player, and how far did each of
  // them go -- had to be reconstructed by reading the lines and taking a
  // maximum per team. That is what `team_bids` already did.
  const render_auction = (auction) => {
    const { sale, team_bids } = auction
    const top = sale || auction.bids[0] || auction.nomination

    const shown = team_bids.slice(0, MAX_VISIBLE_TEAM_BIDS)
    const hidden = team_bids.length - shown.length

    return (
      <div className='auction-transactions__auction' key={auction.key}>
        <div className='auction-transactions__auction-head'>
          <div className='auction-transactions__player'>
            <PlayerName pid={auction.pid} />
          </div>
          <div className='auction-transactions__amount'>
            ${top.transaction.player_salary}
          </div>
        </div>
        <div className='auction-transactions__auction-meta'>
          {/* SOLD OR OPEN, once per auction. Without it a settled auction and
              one still taking bids are the same block with different ages, and
              the leading team reads as the winner in both. */}
          <div className='auction-transactions__status'>
            {sale ? 'sold' : 'open'}
          </div>
          <div className='auction-transactions__bids'>
            {shown.map((team_bid) => (
              <div className='auction-transactions__bid' key={team_bid.tid}>
                <TeamName abbrv tid={team_bid.tid} />
                <span className='auction-transactions__bid-amount'>
                  ${team_bid.amount}
                </span>
              </div>
            ))}
            {hidden > 0 && (
              <div className='auction-transactions__bid'>+{hidden}</div>
            )}
          </div>
          <div className='auction-transactions__timestamp'>
            {format_age(top.transaction.occurred_at)}
          </div>
        </div>
      </div>
    )
  }

  // The header doubles as the collapsed summary, so what a manager reads with
  // the panel shut is what they read with it open. A <div> rather than an <h3>
  // because the summary is a real <button>.
  const header = (
    <div className='auction-transactions__header'>
      <div className='auction-transactions__title'>Transactions</div>
      <div>{auctions.length}</div>
    </div>
  )

  const body = (
    <>
      {!auctions.length && (
        <div className='auction-transactions__empty'>
          No auction activity yet.
        </div>
      )}

      {Boolean(visible.length) && (
        <div className='auction-transactions__list'>
          {visible.map(render_auction)}
        </div>
      )}

      {auctions.length > visible.length && (
        <div className='auction-transactions__more'>
          {auctions.length - visible.length} older not shown
        </div>
      )}
    </>
  )

  // COLLAPSED AT EVERY WIDTH, not just on the phone. The ledger is the one
  // panel in the rail a manager reads backwards, and it is the longest, so it
  // sits shut under the calendar and the settlement status until it is asked
  // for. The count in the header is what the shut panel still answers.
  return (
    <Accordion className='auction-transactions' summary={header}>
      {body}
    </Accordion>
  )
}

AuctionTransactions.propTypes = {
  transactions: PropTypes.array
}
