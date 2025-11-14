import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import PlayerLabel from '@components/player-label'
import { constants } from '@libs-shared'

import './trade-select-player.styl'

const slot_display_config = {
  [constants.slots.BENCH]: { label: 'Active', className: 'slot-badge-active' },
  [constants.slots.PS]: { label: 'PS', className: 'slot-badge-ps' },
  [constants.slots.PSP]: { label: 'PS (P)', className: 'slot-badge-ps' },
  [constants.slots.PSD]: { label: 'PSD', className: 'slot-badge-psd' },
  [constants.slots.PSDP]: { label: 'PSD (P)', className: 'slot-badge-psd' },
  [constants.slots.RESERVE_SHORT_TERM]: {
    label: 'IR',
    className: 'slot-badge-reserve'
  },
  [constants.slots.RESERVE_LONG_TERM]: {
    label: 'IR (LT)',
    className: 'slot-badge-reserve'
  },
  [constants.slots.COV]: { label: 'COV', className: 'slot-badge-reserve' }
}

constants.starterSlots.forEach((slot) => {
  if (!slot_display_config[slot]) {
    slot_display_config[slot] = {
      label: 'Active',
      className: 'slot-badge-active'
    }
  }
})

function render_slot_badge({ player_map }) {
  const slot = player_map.get('slot')

  if (!slot) {
    return null
  }

  const config = slot_display_config[slot] || {
    label: 'BE',
    className: 'slot-badge-active'
  }

  return (
    <span className={`trade-select-player-slot-badge ${config.className}`}>
      {config.label}
    </span>
  )
}

export default function TradeSelectPlayer({
  player_map = null,
  isSelected = false
}) {
  if (!player_map) {
    return null
  }

  const class_names = ['trade__select-player']
  if (isSelected) {
    class_names.push('selected')
  }

  return (
    <div className={class_names.join(' ')}>
      <div className='player__name-position'>
        <Position pos={player_map.get('pos')} />
      </div>
      <div className='player__name-main'>
        <span>{player_map.get('pname')}</span>
        {constants.year === player_map.get('nfl_draft_year') && (
          <PlayerLabel label='R' type='rookie' description='Rookie' />
        )}
        <NFLTeam team={player_map.get('team')} />
        {render_slot_badge({ player_map })}
      </div>
    </div>
  )
}

TradeSelectPlayer.propTypes = {
  player_map: ImmutablePropTypes.map,
  isSelected: PropTypes.bool
}
