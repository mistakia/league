import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsPassingPressure = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Pressure</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='SK' value='stats.sk' />
      <PlayerHeader className='player__row-metric' label='SK YDS' value='stats.sky' />
      <PlayerHeader className='player__row-metric' label='SK%' value='stats.sk_pct' />
      <PlayerHeader className='player__row-metric' label='HIT%' value='stats.qbhi_pct' />
      <PlayerHeader className='player__row-metric' label='PRSS%' value='stats.qbp_pct' />
      <PlayerHeader className='player__row-metric' label='HRRY%' value='stats.qbhu_pct' />
      <PlayerHeader className='player__row-metric' label='NYPA' value='stats.sk_pct' />
    </div>
  </div>
)

export default HeaderStatsPassingPressure
