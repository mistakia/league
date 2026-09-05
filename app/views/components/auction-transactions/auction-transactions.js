import React, { useState } from 'react'
import PropTypes from 'prop-types'

import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import Accordion from '@components/accordion'
import Button from '@components/button'
import ButtonGroup from '@components/button-group'
import { timeago } from '@core/utils'

import './auction-transactions.styl'

const kind_display_names = {
  nomination: 'Nominated',
  bid: 'Bid',
  processed: 'Sold'
}

const empty_messages = {
  processed: 'No players have sold yet.',
  bid: 'No bids yet.',
  nomination: 'No players have been nominated yet.',
  all: 'No auction activity yet.'
}

// A full auction is one nomination and several bids per player across a few
// hundred players, and every row here mounts a connected `PlayerName` and a
// connected `TeamName`. The rail is a reference surface read in glances rather
// than a ledger read to the bottom, so it shows the newest run and says how
// many rows it is not showing.
const MAX_VISIBLE_ROWS = 50

export default function AuctionTransactions({
  transactions,
  is_collapsible = false
}) {
  const [filter, set_filter] = useState('processed')

  const rows =
    filter === 'all'
      ? transactions
      : transactions.filter((row) => row.kind === filter)
  const visible = rows.slice(0, MAX_VISIBLE_ROWS)

  // WRITTEN OUT RATHER THAN MAPPED, for two rules that meet here. A segment
  // must be a DIRECT `.button` child of the group -- a wrapper is reached by
  // none of the paint that makes the four read as one control -- so there is
  // nowhere to hang a `key` but the Button itself, and
  // `test/app.connected-component-props.spec.mjs` fails a Button handed a prop
  // it does not declare. Four separate children need no keys at all.
  const render_filter = (value, label) => (
    <Button
      small
      is_active={filter === value}
      onClick={() => set_filter(value)}
    >
      {label}
    </Button>
  )

  const render_row = (row) => {
    const { transaction } = row

    return (
      <div className='auction-transactions__row' key={row.key}>
        <div className='auction-transactions__team'>
          <TeamName abbrv color tid={transaction.tid} />
        </div>
        {/* PlayerName renders a FRAGMENT of two siblings, so it needs a flex
            element of its own or its status chip wraps away from the name. */}
        <div className='auction-transactions__player'>
          <PlayerName pid={transaction.pid} />
        </div>
        <div className='auction-transactions__amount'>
          ${transaction.player_salary}
        </div>
        {/* Only under `all`, where it is the one thing telling two rows apart.
            Under a single-kind filter it repeats the selected segment on every
            row and crowds the name beside it. */}
        {filter === 'all' && (
          <div className='auction-transactions__kind'>
            {kind_display_names[row.kind]}
          </div>
        )}
        {/* Absent on an election-mode sale: `broadcast_auction_settlement`
            carries the price and the winner and no timestamp, so the row is
            drawn without one rather than with an Invalid Date. */}
        {transaction.occurred_at && (
          <div className='auction-transactions__timestamp'>
            {timeago.format(new Date(transaction.occurred_at), 'league_short')}
          </div>
        )}
      </div>
    )
  }

  // The header doubles as the collapsed summary, so what a manager reads with
  // the panel shut is what they read with it open. A <div> rather than an <h3>
  // because the summary is a real <button>.
  const header = (
    <div className='auction-transactions__header'>
      <div className='auction-transactions__title'>Transactions</div>
      <div>{rows.length}</div>
    </div>
  )

  const body = (
    <>
      {/* ONE FILTER, ONE KIND. The three kinds answer different questions --
          what sold and for how much, who is bidding on the open player, and
          which players have been put up -- and mixing them puts the sales a
          manager is pricing against behind every bid of the auction. `all` is
          the interleaved read for anyone following the board live, and it is
          not the default. */}
      <ButtonGroup className='auction-transactions__filters'>
        {render_filter('processed', 'Processed')}
        {render_filter('bid', 'Bids')}
        {render_filter('nomination', 'Nominations')}
        {render_filter('all', 'All')}
      </ButtonGroup>

      {!rows.length && (
        <div className='auction-transactions__empty'>
          {empty_messages[filter]}
        </div>
      )}

      {Boolean(visible.length) && (
        <div className='auction-transactions__list'>
          {visible.map(render_row)}
        </div>
      )}

      {rows.length > visible.length && (
        <div className='auction-transactions__more'>
          {rows.length - visible.length} older not shown
        </div>
      )}
    </>
  )

  // Collapsed by default on the phone, where the rail stacks under the board
  // and does not scroll -- an open list there pushes the calendar and the
  // settlement status off the bottom of the screen.
  if (is_collapsible) {
    return (
      <Accordion className='auction-transactions' summary={header}>
        {body}
      </Accordion>
    )
  }

  return (
    <div className='auction-transactions'>
      {header}
      {body}
    </div>
  )
}

AuctionTransactions.propTypes = {
  transactions: PropTypes.array,
  is_collapsible: PropTypes.bool
}
