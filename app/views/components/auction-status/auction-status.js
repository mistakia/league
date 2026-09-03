import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'

import TeamName from '@components/team-name'
import PlayerName from '@components/player-name'

import './auction-status.styl'

/**
 * The auction's standing status, published in the side rail.
 *
 * The bid bar shows the OPEN PLAYER, and only while one is open; the settlement
 * status names which teams have not elected. Neither says who the auction as a
 * whole is waiting on between players, so this labeled section carries that
 * state for the whole period -- whose turn to nominate, or that a sale or a
 * live block is in progress -- visible without opening anything.
 *
 * The header is a <div> to match the standing-elections title, and for the same
 * reason: the accordion summary beside it is a real <button>, and a heading
 * inside one is not phrasing content.
 */
export default function AuctionStatus({
  auction_mode,
  nominated_pid,
  nominating_team_id,
  my_team_id,
  isPaused,
  is_initialized,
  isComplete,
  isStarted,
  free_agency_period_start,
  bidValue,
  block_end_at,
  is_final_block
}) {
  let line
  if (!free_agency_period_start) {
    line = 'The auction has not been scheduled.'
  } else if (isComplete) {
    line = 'Auction is complete.'
  } else if (!isStarted) {
    line = `Auction begins ${free_agency_period_start.format('MMMM D, ha')}.`
  } else if (!is_initialized) {
    // The panel exists to be readable without opening anything, which makes a
    // wrong line worse here than anywhere else on the page. `isPaused` defaults
    // true, so this branch said `Auction is paused.` until AUCTION_INIT landed
    // and forever if it never did.
    line = 'Loading the auction…'
  } else if (isPaused) {
    line = 'Auction is paused.'
  } else if (auction_mode === 'live') {
    line = (
      <>
        {is_final_block ? 'Final' : 'Live'} block
        {block_end_at
          ? ` runs until ${dayjs.unix(block_end_at).format('h:mm A')}`
          : ''}
        {nominated_pid ? ' with a player open.' : ' — waiting on a nomination.'}
      </>
    )
  } else if (nominated_pid) {
    line = (
      <>
        Selling <PlayerName pid={nominated_pid} />
        {typeof bidValue === 'number' ? ` for $${bidValue}.` : '.'}
      </>
    )
  } else if (nominating_team_id === my_team_id) {
    line = 'Your turn to nominate a player.'
  } else {
    line = (
      <>
        Waiting for <TeamName tid={nominating_team_id} abbrv /> to nominate.
      </>
    )
  }

  return (
    <div className='auction-status'>
      <div className='auction-status__header'>Auction Status</div>
      <div className='auction-status__line'>{line}</div>
    </div>
  )
}

AuctionStatus.propTypes = {
  auction_mode: PropTypes.string,
  nominated_pid: PropTypes.string,
  nominating_team_id: PropTypes.number,
  my_team_id: PropTypes.number,
  isPaused: PropTypes.bool,
  is_initialized: PropTypes.bool,
  isComplete: PropTypes.bool,
  isStarted: PropTypes.bool,
  free_agency_period_start: PropTypes.object,
  bidValue: PropTypes.number,
  block_end_at: PropTypes.number,
  is_final_block: PropTypes.bool
}
