import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsPassingBasic = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Passing</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='table__cell metric' label='YDS' value='stats.py' />
      <PlayerHeader className='table__cell metric' label='TD' value='stats.tdp' />
      <PlayerHeader className='table__cell metric' label='INT' value='stats.ints' />
      <PlayerHeader className='table__cell metric' label='DAY' value='stats.drppy' />
    </div>
  </div>
)

export default HeaderStatsPassingBasic
