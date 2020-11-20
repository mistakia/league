import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsPassingAiryards = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Air Yards</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='table__cell metric' label='AY' value='stats.pdot' />
      <PlayerHeader className='table__cell metric' label='CAY/C' value='stats.pcay_pc' />
      <PlayerHeader className='table__cell metric' label='PACR' value='stats._pacr' />
    </div>
  </div>
)

export default HeaderStatsPassingAiryards
