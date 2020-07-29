import React from 'react'

import Position from '@components/position'
import Team from '@components/team'
import { constants } from '@common'
import Button from '@components/button'

import './player-slot.styl'

export default class PlayerSlot extends React.Component {
  render () {
    const { player, slot, handleSelect, selected, handleUpdate } = this.props

    const slotName = Object.keys(constants.slots).find(key => constants.slots[key] === slot)

    let action
    if (!selected && player.player) {
      action = (
        <Button
          onClick={() => handleSelect({ slot, player: player.player, pos: player.pos1 })}
          small
        >
          Move
        </Button>
      )
    } else if (selected && !player.player && (slotName.includes(selected.pos) || slot === constants.slots.BENCH)) {
      action = (
        <Button
          onClick={() => handleUpdate({ slot })}
          small
        >
          Here
        </Button>
      )
    } else if (selected && player.player && selected.player === player.player) {
      action = (
        <Button
          onClick={() => handleSelect(null)}
          small
        >
          Cancel
        </Button>
      )
    }

    const classNames = ['player__slot']
    if (selected) {
      classNames.push('selected')
    }

    return (
      <div className={classNames.join(' ')}>
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
        <div className='player__slot-action'>
          {action}
        </div>
      </div>
    )
  }
}
