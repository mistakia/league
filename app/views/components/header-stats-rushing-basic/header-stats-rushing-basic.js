import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsRushingBasic = () => (
  <div className='player__row-group'>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='YDS' value='stats.ry' />
      <PlayerHeader className='player__row-metric' label='TD' value='stats.tdr' />
      <PlayerHeader className='player__row-metric' label='YPC' value='stats.ry_pra' />
    </div>
  </div>
)

export default HeaderStatsRushingBasic
