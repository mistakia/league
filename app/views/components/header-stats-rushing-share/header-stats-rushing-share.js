import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsRushingShare = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Team Share</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='table__cell metric' label='ATT%' value='stats._stra' />
      <PlayerHeader className='table__cell metric' label='YDS%' value='stats._stry' />
    </div>
  </div>
)

export default HeaderStatsRushingShare
