import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsRushingBasic = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Rushing</div>
    <div className='player__row-group-body'>
      <PlayerHeader
        className='table__cell metric'
        label='YDS'
        value='stats.ry'
      />
      <PlayerHeader
        className='table__cell metric'
        label='TD'
        value='stats.tdr'
      />
      <PlayerHeader
        className='table__cell metric'
        label='Y/A'
        value='stats.ry_pra'
      />
    </div>
  </div>
)

export default HeaderStatsRushingBasic
