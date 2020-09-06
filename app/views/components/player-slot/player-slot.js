import React from 'react'

import { constants, toStringArray } from '@common'
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
    } else if (slot === constants.slots.BENCH || selected) {
      return null
    }

    const classNames = ['player__slot']
    if (selected) {
      classNames.push('selected')
    }

    const week = Math.max(constants.season.week, 1)

    const statSuffix = {
      pa: 'att',
      pc: 'comp',
      py: 'yds',
      ints: 'ints',
      tdp: 'TD',

      ra: 'car',
      ry: 'yds',
      tdr: 'TD',
      fuml: 'fuml',

      trg: 'tar',
      rec: 'rec',
      recy: 'yds',
      tdrec: 'TD',

      snp: '',

      twoptc: ''
    }

    const passing = []
    for (const stat of ['pa', 'pc', 'py', 'ints', 'tdp']) {
      const value = player.getIn(['projection', `${week}`, stat], 0)
      if (value) {
        passing.push(`${value.toFixed(1)} ${statSuffix[stat]}`)
      }
    }

    const rushing = []
    for (const stat of ['ra', 'ry', 'tdr', 'fuml']) {
      const value = player.getIn(['projection', `${week}`, stat], 0)
      if (value) {
        rushing.push(`${value.toFixed(1)} ${statSuffix[stat]}`)
      }
    }

    const receiving = []
    for (const stat of ['trg', 'rec', 'recy', 'tdrec']) {
      const value = player.getIn(['projection', `${week}`, stat], 0)
      if (value) {
        receiving.push(`${value.toFixed(1)} ${statSuffix[stat]}`)
      }
    }

    return (
      <div className={classNames.join(' ')}>
        <div className='player__slot-slotName'>{slotName}</div>
        <div className='player__slot-player'>
          <PlayerNameExpanded playerId={player.player} hideActions />
          {!!passing.length &&
            <div className='player__slot-projected-stats'>
              {toStringArray(passing)}
            </div>}
          {!!rushing.length &&
            <div className='player__slot-projected-stats'>
              {toStringArray(rushing)}
            </div>}
          {!!receiving.length &&
            <div className='player__slot-projected-stats'>
              {toStringArray(receiving)}
            </div>}
          {/* projected output */}
          {/* expert consensus ranking */}
        </div>
        <div className='player__slot-projected-points metric'>
          {player.getIn(['points', `${week}`, 'total'], 0).toFixed(1)}
        </div>
        <div className='player__slot-action'>
          {action}
        </div>
      </div>
    )
  }
}
