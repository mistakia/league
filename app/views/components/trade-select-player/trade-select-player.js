import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import PlayerLabel from '@components/player-label'

import './trade-select-player.styl'
import {
  current_season,
  roster_slot_types,
  starting_lineup_slots
} from '@constants'

const slot_display_config = {
  [roster_slot_types.BENCH]: {
    label: 'Active',
    className: 'slot-badge-active'
  },
  [roster_slot_types.PS]: { label: 'PS', className: 'slot-badge-ps' },
  [roster_slot_types.PSP]: { label: 'PS (P)', className: 'slot-badge-ps' },
  [roster_slot_types.PSD]: { label: 'PSD', className: 'slot-badge-psd' },
  [roster_slot_types.PSDP]: { label: 'PSD (P)', className: 'slot-badge-psd' },
  [roster_slot_types.RESERVE_SHORT_TERM]: {
    label: 'IR',
    className: 'slot-badge-reserve'
  },
  [roster_slot_types.RESERVE_LONG_TERM]: {
    label: 'IR (LT)',
    className: 'slot-badge-reserve'
  },
  [roster_slot_types.COV]: { label: 'COV', className: 'slot-badge-reserve' }
}

starting_lineup_slots.forEach((slot) => {
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
        {current_season.year === player_map.get('nfl_draft_year') && (
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
