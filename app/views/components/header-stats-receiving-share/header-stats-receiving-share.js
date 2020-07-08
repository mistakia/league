import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsReceivingShare = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Team Share</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='AY%' value='stats._strtay' />
      <PlayerHeader className='player__row-metric' label='TAR%' value='stats._sttrg' />
      <PlayerHeader className='player__row-metric' label='WOPR' value='stats._wopr' />
    </div>
  </div>
)

export default HeaderStatsReceivingShare
