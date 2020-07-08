import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsRushingProductivity = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Productivity</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='ATT' value='stats.ra' />
      <PlayerHeader className='player__row-metric' label='FD' value='stats.rfd' />
      <PlayerHeader className='player__row-metric' label='POS' value='stats.posra' />
    </div>
  </div>
)

export default HeaderStatsRushingProductivity
