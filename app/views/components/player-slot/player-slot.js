import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants, toStringArray } from '@libs-shared'
import Button from '@components/button'
import PlayerNameExpanded from '@components/player-name-expanded'

import './player-slot.styl'

export default class PlayerSlot extends React.Component {
  render() {
    const {
      player_map,
      slot,
      handleSelect,
      selected_player_slot,
      handleUpdate,
      isLocked
    } = this.props

    const slotPositions = Object.keys(constants.slots).find(
      (key) => constants.slots[key] === slot
    )
    const slotName = constants.slotName[slot]
    const pid = player_map.get('pid')

    let action
    if (constants.week > constants.season.finalWeek) {
      return null
    } else if (!selected_player_slot && pid) {
      action = (
        <Button
          disabled={isLocked}
          onClick={() =>
            handleSelect({ slot, pid, pos: player_map.get('pos') })
          }
          small
        >
          {isLocked ? 'Locked' : 'Move'}
        </Button>
      )
    } else if (selected_player_slot) {
      if (pid && selected_player_slot.pid === pid) {
        action = (
          <Button onClick={() => handleSelect(null)} small>
            Cancel
          </Button>
        )
      } else if (
        !isLocked &&
        slotPositions.includes(selected_player_slot.pos)
      ) {
        action = (
          <Button onClick={() => handleUpdate({ slot, player_map })} small>
            Here
          </Button>
        )
      } else if (!pid && slot === constants.slots.BENCH) {
        action = (
          <Button onClick={() => handleUpdate({ slot })} small>
            Here
          </Button>
        )
      } else {
        return null
      }
    }

    const classNames = ['player__slot']
    if (selected_player_slot) {
      classNames.push('selected')
    }

    const week = Math.max(constants.week, 1)

    const statSuffix = {
      pa: 'pass att',
      pc: 'pass comp',
      py: 'pass yds',
      ints: 'ints',
      tdp: 'pass TD',

      ra: 'rush att',
      ry: 'rush yds',
      tdr: 'rush TD',
      fuml: 'fum lost',

      trg: 'tar',
      rec: 'rec',
      recy: 'rec yds',
      tdrec: 'rec TD',

      snp: 'snp',

      twoptc: 'twoptc'
    }

    const passing = []
    for (const stat of ['pa', 'pc', 'py', 'ints', 'tdp']) {
      const value = player_map.getIn(['projection', `${week}`, stat], 0)
      if (value) {
        passing.push(`${value.toFixed(1)} ${statSuffix[stat]}`)
      }
    }

    const rushing = []
    for (const stat of ['ra', 'ry', 'tdr', 'fuml']) {
      const value = player_map.getIn(['projection', `${week}`, stat], 0)
      if (value) {
        rushing.push(`${value.toFixed(1)} ${statSuffix[stat]}`)
      }
    }

    const receiving = []
    for (const stat of ['trg', 'rec', 'recy', 'tdrec']) {
      const value = player_map.getIn(['projection', `${week}`, stat], 0)
      if (value) {
        receiving.push(`${value.toFixed(1)} ${statSuffix[stat]}`)
      }
    }

    const projectedPoints = player_map.getIn(['points', `${week}`, 'total'], 0)

    return (
      <div className={classNames.join(' ')}>
        <div className='player__slot-slotName'>{slotName}</div>
        <div className='player__slot-player'>
          <PlayerNameExpanded pid={pid} hideActions />
          {Boolean(passing.length) && (
            <div className='player__slot-projected-stats'>
              {toStringArray(passing)}
            </div>
          )}
          {Boolean(rushing.length) && (
            <div className='player__slot-projected-stats'>
              {toStringArray(rushing)}
            </div>
          )}
          {Boolean(receiving.length) && (
            <div className='player__slot-projected-stats'>
              {toStringArray(receiving)}
            </div>
          )}
          {/* projected output */}
          {/* expert consensus ranking */}
        </div>
        <div className='player__slot-right'>
          <div className='player__slot-projected-points metric'>
            {projectedPoints ? projectedPoints.toFixed(1) : '-'}
          </div>
          <div className='player__slot-action'>{action}</div>
        </div>
      </div>
    )
  }
}

PlayerSlot.propTypes = {
  player_map: ImmutablePropTypes.map,
  slot: PropTypes.number,
  handleSelect: PropTypes.func,
  selected_player_slot: PropTypes.object,
  handleUpdate: PropTypes.func,
  isLocked: PropTypes.bool
}
