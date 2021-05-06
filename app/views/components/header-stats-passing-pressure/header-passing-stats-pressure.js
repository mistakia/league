import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsPassingPressure = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Pressure</div>
    <div className='player__row-group-body'>
      <PlayerHeader
        className='table__cell metric'
        label='SK'
        value='stats.sk'
      />
      <PlayerHeader
        className='table__cell metric'
        label='SKY'
        value='stats.sky'
      />
      <PlayerHeader
        className='table__cell metric'
        label='SK%'
        value='stats.sk_pct'
      />
      <PlayerHeader
        className='table__cell metric'
        label='HIT%'
        value='stats.qbhi_pct'
      />
      <PlayerHeader
        className='table__cell metric'
        label='PRSS%'
        value='stats.qbp_pct'
      />
      <PlayerHeader
        className='table__cell metric'
        label='HRRY%'
        value='stats.qbhu_pct'
      />
      <PlayerHeader
        className='table__cell metric'
        label='NY/A'
        value='stats._nygpa'
      />
    </div>
  </div>
)

export default HeaderStatsPassingPressure
