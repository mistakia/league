import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import AuctionTeam from '@components/auction-team'
import AuctionMainBid from '@components/auction-main-bid'

import './auction-controls.styl'

export default function AuctionControls({ tids, join, load_league }) {
  useEffect(() => {
    load_league()
    join()
  }, [join, load_league])

  const teamItems = []
  tids.forEach((tid, index) => {
    teamItems.push(<AuctionTeam key={index} tid={tid} />)
  })

  return (
    <div className='auction__controls'>
      <AuctionMainBid />
      <div className='auction__teams'>{teamItems}</div>
    </div>
  )
}

AuctionControls.propTypes = {
  tids: ImmutablePropTypes.list,
  join: PropTypes.func,
  load_league: PropTypes.func
}
