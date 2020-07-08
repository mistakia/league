import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsReceivingAdvanced = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Advanced</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='AY/TAR' value='stats._ayptrg' />
      <PlayerHeader className='player__row-metric' label='YDS/AY' value='stats._recypay' />
      <PlayerHeader className='player__row-metric' label='YDS/REC' value='stats._recyprec' />
      <PlayerHeader className='player__row-metric' label='YDS/TAR' value='stats._recyptrg' />
      <PlayerHeader className='player__row-metric' label='YAC/REC' value='stats._ryacprec' />
    </div>
  </div>
)

export default HeaderStatsReceivingAdvanced
