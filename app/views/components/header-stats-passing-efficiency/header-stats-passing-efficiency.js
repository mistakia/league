import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsPassingEfficiency = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Efficiency</div>
    <div className='player__row-group-body'>
      <PlayerHeader
        className='table__cell metric'
        label='COMP%'
        value='stats.pc_pct'
      />
      <PlayerHeader
        className='table__cell metric'
        label='TD%'
        value='stats.tdp_pct'
      />
      <PlayerHeader
        className='table__cell metric'
        label='INT%'
        value='stats.ints_pct'
      />
      <PlayerHeader
        className='table__cell metric'
        label='INTW%'
        value='stats.intw_pct'
      />
    </div>
  </div>
)

export default HeaderStatsPassingEfficiency
