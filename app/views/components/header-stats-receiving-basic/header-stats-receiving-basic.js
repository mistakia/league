import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsReceivingBasic = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Receiving</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='REC' value='stats.rec' />
      <PlayerHeader className='player__row-metric' label='YDS' value='stats.recy' />
      <PlayerHeader className='player__row-metric' label='TD' value='stats.tdrec' />
      <PlayerHeader className='player__row-metric' label='DRP' value='stats.drp' />
      <PlayerHeader className='player__row-metric' label='DYDS' value='stats.drprecy' />
    </div>
  </div>
)

export default HeaderStatsReceivingBasic
