import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsRushingAdvanced = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Advanced</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='table__cell metric' label='FUM%' value='stats._fumlpra' />
      <PlayerHeader className='table__cell metric' label='POS%' value='stats.posra_pra' />
      <PlayerHeader className='table__cell metric' label='SUCC%' value='stats.rasucc_pra' />
    </div>
  </div>
)

export default HeaderStatsRushingAdvanced
