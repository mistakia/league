import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsFantasy = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Fantasy</div>
    <div className='player__row-group-body'>
      <PlayerHeader
        className='table__cell metric'
        label='PTS'
        value='stats.pts'
      />
    </div>
  </div>
)

export default HeaderStatsFantasy
