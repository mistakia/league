import React from 'react'
import PropTypes from 'prop-types'

import './auction-settlement-status.styl'

/**
 * Who the auction is waiting on.
 *
 * With no forcing function in election mode, making this visible IS the forcing
 * function -- nothing in software pushes a quiet team to elect, so the pressure
 * is social and this is what supplies it.
 *
 * NAMES WHO, NEVER WHAT. A team that has elected is shown as having elected,
 * with no amount, whether or not the viewer is the commissioner. In this league
 * the commissioner is a competing manager, so the surface that would most
 * naturally show every ceiling is the one that must not -- and the amounts are
 * not merely hidden here, they never reach any client.
 */
export default function AuctionSettlementStatus({
  auction_mode,
  outstanding_election_tids,
  teams_by_id,
  nominated_pid
}) {
  if (auction_mode !== 'election' || !nominated_pid) {
    return null
  }

  if (!outstanding_election_tids.size) {
    return (
      <div className='auction-settlement-status'>
        Every eligible team has elected. Settling.
      </div>
    )
  }

  const names = outstanding_election_tids
    .map((tid) => {
      const team = teams_by_id.get(tid)
      return team ? team.name : `Team ${tid}`
    })
    .join(', ')

  return (
    <div className='auction-settlement-status'>
      Waiting on {names} to make an election.
    </div>
  )
}

AuctionSettlementStatus.propTypes = {
  auction_mode: PropTypes.string,
  outstanding_election_tids: PropTypes.object,
  teams_by_id: PropTypes.object,
  nominated_pid: PropTypes.string
}
