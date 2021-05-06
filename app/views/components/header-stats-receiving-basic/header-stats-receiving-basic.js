import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsReceivingBasic = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Receiving</div>
    <div className='player__row-group-body'>
      <PlayerHeader
        className='table__cell metric'
        label='REC'
        value='stats.rec'
      />
      <PlayerHeader
        className='table__cell metric'
        label='YDS'
        value='stats.recy'
      />
      <PlayerHeader
        className='table__cell metric'
        label='TD'
        value='stats.tdrec'
      />
      <PlayerHeader
        className='table__cell metric'
        label='DRP'
        value='stats.drp'
      />
      <PlayerHeader
        className='table__cell metric'
        label='DYDS'
        value='stats.drprecy'
      />
    </div>
  </div>
)

export default HeaderStatsReceivingBasic
