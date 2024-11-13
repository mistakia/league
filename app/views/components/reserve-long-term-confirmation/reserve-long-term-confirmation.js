import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'

import Button from '@components/button'
import { constants } from '@libs-shared'

export default function ReserveLongTermConfirmation({
  playerMap,
  reserve,
  onClose
}) {
  const handle_submit = () => {
    const reserve_pid = playerMap.get('pid')
    reserve({ reserve_pid, slot: constants.slots.IR_LONG_TERM })
    onClose()
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Designate Reserve/IR (Long Term)</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {`${playerMap.get('fname')} ${playerMap.get(
            'lname'
          )} (${playerMap.get(
            'pos'
          )}) will be placed on Reserves/IR (Long Term). You will not be able to activate him until the offseason.`}
        </DialogContentText>
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

ReserveLongTermConfirmation.propTypes = {
  onClose: PropTypes.func,
  reserve: PropTypes.func,
  playerMap: ImmutablePropTypes.map
}
