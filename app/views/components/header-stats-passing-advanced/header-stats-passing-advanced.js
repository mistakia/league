import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsPassingAdvanced = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Advanced</div>
    <div className='player__row-group-body'>
      <PlayerHeader
        className='table__cell metric'
        label='YAC'
        value='stats.pyac'
      />
      <PlayerHeader
        className='table__cell metric'
        label='YAC/C'
        value='stats.pyac_pc'
      />
      <PlayerHeader
        className='table__cell metric'
        label='Y/A'
        value='stats._ypa'
      />
      <PlayerHeader
        className='table__cell metric'
        label='DOT'
        value='stats.pdot_pa'
      />
    </div>
  </div>
)

export default HeaderStatsPassingAdvanced
