import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsReceivingOpportunity = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Opportunity</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='table__cell metric' label='TAR' value='stats.trg' />
      <PlayerHeader className='table__cell metric' label='DEEP%' value='stats.dptrg_pct' />
      <PlayerHeader className='table__cell metric' label='DOT' value='stats.rdot_ptrg' />
      <PlayerHeader className='table__cell metric' label='AY%' value='stats._stray' />
      <PlayerHeader className='table__cell metric' label='TAR%' value='stats._sttrg' />
      <PlayerHeader className='table__cell metric' label='WOPR' value='stats._wopr' />
    </div>
  </div>
)

export default HeaderStatsReceivingOpportunity
