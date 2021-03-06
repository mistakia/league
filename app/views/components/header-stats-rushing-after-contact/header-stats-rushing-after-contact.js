import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsRushingAfterContact = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>After Contact</div>
    <div className='player__row-group-body'>
      <PlayerHeader
        className='table__cell metric'
        label='YDS'
        value='stats.ryaco'
      />
      <PlayerHeader
        className='table__cell metric'
        label='AVG'
        value='stats.ryaco_pra'
      />
    </div>
  </div>
)

export default HeaderStatsRushingAfterContact
