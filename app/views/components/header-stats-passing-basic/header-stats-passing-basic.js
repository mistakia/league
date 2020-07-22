import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsPassingBasic = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Passing</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='YDS' value='stats.py' />
      <PlayerHeader className='player__row-metric' label='TD' value='stats.tdp' />
      <PlayerHeader className='player__row-metric' label='INT' value='stats.ints' />
      <PlayerHeader className='player__row-metric' label='DAY' value='stats.drppy' />
    </div>
  </div>
)

export default HeaderStatsPassingBasic
