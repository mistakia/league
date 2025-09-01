import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import AuctionTeam from '@components/auction-team'
import AuctionMainBid from '@components/auction-main-bid'

import './auction-controls.styl'

export default function AuctionControls({
  tids,
  join,
  load_league,
  is_logged_in,
  auction_is_ended
}) {
  useEffect(() => {
    load_league()
    if (is_logged_in && !auction_is_ended) {
      join()
    }
  }, [join, load_league, is_logged_in, auction_is_ended])

  // TODO allow non logged in users to follow the auction
  if (!is_logged_in) {
    return null
  }

  const teamItems = []
  tids.forEach((tid, index) => {
    teamItems.push(<AuctionTeam key={index} tid={tid} />)
  })

  return (
    <div className='auction__controls'>
      <AuctionMainBid />
      {Boolean(teamItems.length) && (
        <div className='auction__teams'>{teamItems}</div>
      )}
    </div>
  )
}

AuctionControls.propTypes = {
  tids: ImmutablePropTypes.list,
  join: PropTypes.func,
  load_league: PropTypes.func,
  is_logged_in: PropTypes.bool,
  auction_is_ended: PropTypes.bool
}
