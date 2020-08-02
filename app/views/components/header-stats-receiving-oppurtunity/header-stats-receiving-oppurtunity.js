import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsReceivingOppurtunity = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Oppurtunity</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='TAR' value='stats.trg' />
      <PlayerHeader className='player__row-metric' label='DEEP%' value='stats.dptrg_pct' />
      <PlayerHeader className='player__row-metric' label='DOT' value='stats.rdot_ptrg' />
      <PlayerHeader className='player__row-metric' label='AY%' value='stats._stray' />
      <PlayerHeader className='player__row-metric' label='TAR%' value='stats._sttrg' />
      <PlayerHeader className='player__row-metric' label='WOPR' value='stats._wopr' />
    </div>
  </div>
)

export default HeaderStatsReceivingOppurtunity
