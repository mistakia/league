import React from 'react'

import { constants } from '@common'
import Button from '@components/button'
import PlayerNameExpanded from '@components/player-name-expanded'

import './player-slot.styl'

export default class PlayerSlot extends React.Component {
  render () {
    const { player, slot, handleSelect, selected, handleUpdate, isLocked } = this.props

    const slotPositions = Object.keys(constants.slots).find(key => constants.slots[key] === slot)
    const slotName = constants.slotName[slot]

    let action
    if (!selected && player.player) {
      action = (
        <Button
          disabled={isLocked}
          onClick={() => handleSelect({ slot, player: player.player, pos: player.pos1 })}
          small
        >
          {isLocked ? 'Locked' : 'Move'}
        </Button>
      )
    } else if (selected && !player.player && (slotPositions.includes(selected.pos) || slot === constants.slots.BENCH)) {
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
          <PlayerNameExpanded playerId={player.player} hideActions />
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
