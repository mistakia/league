import React, { useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'

import Modal from '@components/modal'
import Button from '@components/button'
import { practice_squad_unprotected_slots, roster_slot_types } from '#constants'

export default function ReserveConfirmation({
  team,
  player_map,
  reserve,
  onClose
}) {
  const has_reserve_space = team.roster.has_open_reserve_short_term_slot()
  const is_practice_squad_activation =
    practice_squad_unprotected_slots.includes(player_map.get('slot'))
  const activatable = []

  const [activate_pid, set_activate_pid] = useState('')
  const [missing_activate, set_missing_activate] = useState(false)

  const reserve_pids = team.roster.reserve.map((p) => p.pid)
  for (const pid of reserve_pids) {
    const player_map = team.players.find((p) => p.get('pid') === pid)
    activatable.push(player_map)
  }

  const handle_select_activate = (event) => {
    const { value } = event.target
    set_activate_pid(value)
    set_missing_activate(false)
  }

  const handle_submit = () => {
    const reserve_pid = player_map.get('pid')

    if (!has_reserve_space && !activate_pid) {
      return set_missing_activate(true)
    } else {
      set_missing_activate(false)
    }

    reserve({
      reserve_pid,
      slot: roster_slot_types.RESERVE_SHORT_TERM,
      activate_pid
    })
    onClose()
  }

  const menuItems = []
  for (const aPlayerMap of activatable) {
    const pid = aPlayerMap.get('pid')
    menuItems.push(
      <MenuItem key={pid} value={pid}>
        {aPlayerMap.get('name')} ({aPlayerMap.get('primary_position')})
      </MenuItem>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        is_practice_squad_activation
          ? 'Activate & Designate Reserve'
          : 'Designate Reserve'
      }
      actions={
        <>
          <Button onClick={onClose} text>
            Cancel
          </Button>
          <Button onClick={handle_submit} text>
            Confirm
          </Button>
        </>
      }
    >
      <p>
        {`${player_map.get('first_name')} ${player_map.get('last_name')} (${player_map.get('primary_position')}) will be placed on Reserves/IR. He will not be available to use in lineups until he's activated.`}
      </p>
      {is_practice_squad_activation && (
        <p>
          This activates him off the practice squad. He will no longer be
          practice squad eligible and can not be returned to the practice squad.
          No active roster space is required.
        </p>
      )}
      {!has_reserve_space && (
        <p>
          No reserve space available, make room by activating a player from
          reserve.
        </p>
      )}
      <div className='confirmation__inputs'>
        {!has_reserve_space && (
          <FormControl size='small' variant='outlined'>
            <InputLabel id='activate-label'>Activate</InputLabel>
            <Select
              labelId='activate-label'
              error={missing_activate}
              value={activate_pid}
              onChange={handle_select_activate}
              label='Activate'
            >
              {menuItems}
            </Select>
          </FormControl>
        )}
      </div>
    </Modal>
  )
}

ReserveConfirmation.propTypes = {
  onClose: PropTypes.func,
  reserve: PropTypes.func,
  player_map: ImmutablePropTypes.map,
  team: PropTypes.object
}
