import React from 'react'

import Position from '@components/position'
import Team from '@components/team'

import './player-slot.styl'

export default class PlayerSlot extends React.Component {
  render () {
    const { player, slot } = this.props

    const slotName = slot.split('_').shift()

    return (
      <div className='player__slot'>
        <div className='player__slot-slotName'>{slotName}</div>
        <div className='player__slot-player'>
          {player &&
            <div className='player__slot-player-name'>
              {player.fname} {player.lname}
            </div>}
          {player &&
            <div className='player__slot-player-info'>
              <Position pos={player.pos1} />
              <Team team={player.team} />
            </div>}
          {/* projected output */}
          {/* expert consensus ranking */}
        </div>
      </div>
    )
  }
}
