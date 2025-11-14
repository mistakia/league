import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import LockIcon from '@mui/icons-material/Lock'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'

import { constants } from '@libs-shared'

import './trade-slot-selector.styl'

const slot_options = [
  {
    value: constants.slots.BENCH,
    label: 'Active Roster',
    description: 'active roster (bench)'
  },
  {
    value: constants.slots.PS,
    label: 'Practice Squad',
    description: 'practice squad (signed)'
  },
  {
    value: constants.slots.PSD,
    label: 'Drafted Practice Squad',
    description: 'drafted practice squad'
  },
  {
    value: constants.slots.RESERVE_SHORT_TERM,
    label: 'Short-Term Reserve',
    description: 'short-term reserve (IR)'
  }
]

function get_available_slots_and_default({ player_map }) {
  const current_slot = player_map.get('slot')

  if (
    current_slot === constants.slots.BENCH ||
    constants.starterSlots.includes(current_slot)
  ) {
    return { available_slots: [], default_slot: constants.slots.BENCH }
  }

  if (
    current_slot === constants.slots.PSD ||
    current_slot === constants.slots.PSDP
  ) {
    return {
      available_slots: [constants.slots.PSD, constants.slots.BENCH],
      default_slot: constants.slots.PSD
    }
  }

  if (
    current_slot === constants.slots.PS ||
    current_slot === constants.slots.PSP
  ) {
    return {
      available_slots: [constants.slots.PS, constants.slots.BENCH],
      default_slot: constants.slots.PS
    }
  }

  if (
    current_slot === constants.slots.RESERVE_SHORT_TERM ||
    current_slot === constants.slots.RESERVE_LONG_TERM ||
    current_slot === constants.slots.COV
  ) {
    return {
      available_slots: [
        constants.slots.RESERVE_SHORT_TERM,
        constants.slots.BENCH
      ],
      default_slot: constants.slots.RESERVE_SHORT_TERM
    }
  }

  return { available_slots: [], default_slot: constants.slots.BENCH }
}

function initialize_slot_if_needed({
  player_map,
  selected_slot,
  pid,
  team_type,
  set_proposing_team_slot,
  set_accepting_team_slot
}) {
  if (!player_map) {
    return
  }

  if (selected_slot !== null && selected_slot !== undefined) {
    return
  }

  const { default_slot } = get_available_slots_and_default({ player_map })

  if (team_type === 'proposing') {
    set_proposing_team_slot(pid, default_slot)
  } else {
    set_accepting_team_slot(pid, default_slot)
  }
}

export default function TradeSlotSelector({
  pid,
  team_type,
  player_map = null,
  selected_slot = null,
  validation_error = null,
  is_editable = true,
  read_only_note = null,
  set_proposing_team_slot,
  set_accepting_team_slot
}) {
  useEffect(() => {
    initialize_slot_if_needed({
      player_map,
      selected_slot,
      pid,
      team_type,
      set_proposing_team_slot,
      set_accepting_team_slot
    })
  }, [
    player_map,
    selected_slot,
    pid,
    team_type,
    set_proposing_team_slot,
    set_accepting_team_slot
  ])

  const handle_change = (event) => {
    const new_slot = parseInt(event.target.value, 10)

    if (team_type === 'proposing') {
      set_proposing_team_slot(pid, new_slot)
    } else {
      set_accepting_team_slot(pid, new_slot)
    }
  }

  if (!player_map) {
    return null
  }

  const { available_slots, default_slot } = get_available_slots_and_default({
    player_map
  })

  if (available_slots.length === 0) {
    return null
  }

  const filtered_options = slot_options.filter((opt) =>
    available_slots.includes(opt.value)
  )

  const current_slot =
    selected_slot !== null && selected_slot !== undefined
      ? selected_slot
      : default_slot

  const selected_option = filtered_options.find(
    (opt) => opt.value === current_slot
  )

  const player_name = player_map?.get('pname') || 'Player'

  if (!is_editable) {
    return (
      <div className='trade-slot-selector-readonly'>
        <LockIcon fontSize='small' className='trade-slot-selector-lock-icon' />
        <span className='trade-slot-selector-readonly-text'>
          <strong>{player_name}</strong> will be placed on{' '}
          <strong>
            {selected_option
              ? selected_option.description
              : 'active roster (bench)'}
          </strong>
        </span>
        {read_only_note && (
          <span className='trade-slot-selector-readonly-note'>
            ({read_only_note})
          </span>
        )}
      </div>
    )
  }

  return (
    <div className='trade-slot-selector'>
      <FormControl size='small' className='trade-slot-selector-form'>
        <div className='trade-slot-selector-label'>
          <span className='trade-slot-selector-arrow'>↳</span>
          <strong>{player_name}</strong> will be placed on{' '}
          <Select
            value={current_slot}
            onChange={handle_change}
            className='trade-slot-selector-select'
            variant='standard'
            disableUnderline
          >
            {filtered_options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.description}
              </MenuItem>
            ))}
          </Select>
        </div>
      </FormControl>
      {validation_error && (
        <div className='trade-slot-selector-error'>{validation_error}</div>
      )}
    </div>
  )
}

TradeSlotSelector.propTypes = {
  pid: PropTypes.string.isRequired,
  team_type: PropTypes.oneOf(['proposing', 'accepting']).isRequired,
  player_map: ImmutablePropTypes.map,
  selected_slot: PropTypes.number,
  validation_error: PropTypes.string,
  is_editable: PropTypes.bool,
  read_only_note: PropTypes.string,
  set_proposing_team_slot: PropTypes.func.isRequired,
  set_accepting_team_slot: PropTypes.func.isRequired
}
