import React from 'react'

import { constants } from '@common'

import './player-slot.styl'

export default class PlayerSlot extends React.Component {
  render () {
    const { player, slot, roster } = this.props
    const { week } = roster

    const slotName = slot.split('_').shift()

    return (
      <div className='player__slot'>
        <div className='player__slot-slotName'>{slotName}</div>
        <div className='player__slot-player'>
          {player && <div className='player__slot-player-name'>{player.fname} {player.lname}</div>}
          {player && <div className='player__slot-player-info'>{player.pos1} {player.team}</div>}
          {/* projected output */}
          {/* expert consensus ranking */}
        </div>
      </div>
    )
  }
}
