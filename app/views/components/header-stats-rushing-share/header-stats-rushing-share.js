import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsRushingShare = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Team Share</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='ATT%' value='stats._stra' />
      <PlayerHeader className='player__row-metric' label='YDS%' value='stats._stry' />
    </div>
  </div>
)

export default HeaderStatsRushingShare
