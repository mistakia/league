import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsRushingBrokenTackles = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Broken Tackles</div>
    <div className='player__row-group-body'>
      <PlayerHeader
        className='table__cell metric'
        label='BT'
        value='stats.mbt'
      />
      <PlayerHeader
        className='table__cell metric'
        label='BT/T'
        value='stats.mbt_pt'
      />
    </div>
  </div>
)

export default HeaderStatsRushingBrokenTackles
