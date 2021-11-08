import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsReceivingEfficiency = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Efficiency</div>
    <div className='player__row-group-body'>
      <PlayerHeader
        className='table__cell metric'
        label='AY/T'
        value='stats._ayptrg'
      />
      <PlayerHeader
        className='table__cell metric'
        label='RACR'
        value='stats._recypay'
      />
      <PlayerHeader
        className='table__cell metric'
        label='Y/R'
        value='stats._recyprec'
      />
      <PlayerHeader
        className='table__cell metric'
        label='Y/T'
        value='stats._recyptrg'
      />
      <PlayerHeader
        className='table__cell metric'
        label='YAC/R'
        value='stats._ryacprec'
      />
    </div>
  </div>
)

export default HeaderStatsReceivingEfficiency
