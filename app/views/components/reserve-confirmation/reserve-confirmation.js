import React, { useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'

import Button from '@components/button'
import { constants } from '@libs-shared'

export default function ReserveConfirmation({
  team,
  playerMap,
  reserve,
  onClose
}) {
  const has_reserve_space = team.roster.hasOpenInjuredReserveSlot()
  const activatable = []

  const [activate_pid, set_activate_pid] = useState('')
  const [missing_activate, set_missing_activate] = useState(false)

  const reserve_pids = team.roster.reserve.map((p) => p.pid)
  for (const pid of reserve_pids) {
    const playerMap = team.players.find((p) => p.get('pid') === pid)
    activatable.push(playerMap)
  }

  const handle_select_activate = (event) => {
    const { value } = event.target
    set_activate_pid(value)
    set_missing_activate(false)
  }

  const handle_submit = () => {
    const reserve_pid = playerMap.get('pid')

    if (!has_reserve_space && !activate_pid) {
      return set_missing_activate(true)
    } else {
      set_missing_activate(false)
    }

    reserve({ reserve_pid, slot: constants.slots.IR, activate_pid })
    onClose()
  }

  const menuItems = []
  for (const aPlayerMap of activatable) {
    const pid = aPlayerMap.get('pid')
    menuItems.push(
      <MenuItem key={pid} value={pid}>
        {aPlayerMap.get('name')} ({aPlayerMap.get('pos')})
      </MenuItem>
    )
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Designate Reserve</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {`${playerMap.get('fname')} ${playerMap.get(
            'lname'
          )} (${playerMap.get(
            'pos'
          )}) will be placed on Reserves/IR. He will not be available to use in lineups until he's activated.`}
        </DialogContentText>
        {!has_reserve_space && (
          <DialogContentText>
            No reserve space available, make room by activating a player from
            reserve.
          </DialogContentText>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} text>
          Cancel
        </Button>
        <Button onClick={handle_submit} text>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}

ReserveConfirmation.propTypes = {
  onClose: PropTypes.func,
  reserve: PropTypes.func,
  playerMap: ImmutablePropTypes.map,
  team: PropTypes.object
}
