import React from 'react'
import PlayerHeader from '@components/player-header'

const HeaderStatsPassingAiryards = () => (
  <div className='player__row-group'>
    <div className='player__row-group-head'>Air Yards</div>
    <div className='player__row-group-body'>
      <PlayerHeader className='player__row-metric' label='AY' value='stats.ptay' />
      <PlayerHeader className='player__row-metric' label='AY/A' value='stats._aypa' />
      <PlayerHeader className='player__row-metric' label='CAY/C' value='stats.pcay_pc' />
      <PlayerHeader className='player__row-metric' label='PACR' value='stats._pacr' />
    </div>
  </div>
)

export default HeaderStatsPassingAiryards
