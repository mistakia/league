import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsRushingAdvanced = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Advanced</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='FUML%' value='stats._fumlpra' />
      <PlayerHeader className='player__row-metric' label='POS%' value='stats.posra_pra' />
      <PlayerHeader className='player__row-metric' label='SUCC%' value='stats.rasucc_pra' />
    </div>
  </div>
)

export default HeaderStatsRushingAdvanced
