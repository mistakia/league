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

export default function DeactivateConfirmation({
  onClose,
  deactivate,
  playerMap,
  team
}) {
  const [release_pid, set_release_pid] = useState('')

  const handleSelectRelease = (event) => {
    const { value } = event.target
    set_release_pid(value)
  }

  const handleSubmit = () => {
    const deactivate_pid = playerMap.get('pid')

    deactivate({
      deactivate_pid,
      release_pid
    })

    onClose()
  }

  const hasPracticeSquadSpace = team.roster.hasOpenPracticeSquadSlot()

  const releaseItems = []
  for (const { pid } of team.roster.practice_signed) {
    const release_player_map = team.players.find(
      (playerMap) => playerMap.get('pid') === pid
    )
    releaseItems.push(
      <MenuItem key={pid} value={pid}>
        {release_player_map.get('name')} ({release_player_map.get('pos')})
      </MenuItem>
    )
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Deactivate Player</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {`${playerMap.get('fname')} ${playerMap.get(
            'lname'
          )} (${playerMap.get(
            'pos'
          )}) will be placed on the practice squad. He will not be available to use in lineups until he's reactivated.`}
        </DialogContentText>
      </DialogContent>
      <DialogContent>
        {!hasPracticeSquadSpace && (
          <DialogContentText>
            No practice squad space available, make room by releasing a signed
            practice squad player
          </DialogContentText>
        )}
        <div className='confirmation__inputs'>
          {!hasPracticeSquadSpace && (
            <FormControl size='small' variant='outlined'>
              <InputLabel id='release-label'>Release</InputLabel>
              <Select
                labelId='release-label'
                error={!release_pid}
                value={release_pid}
                onChange={handleSelectRelease}
                label='Release'
              >
                {releaseItems}
              </Select>
            </FormControl>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} text>
          Cancel
        </Button>
        <Button onClick={handleSubmit} text>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}

DeactivateConfirmation.propTypes = {
  onClose: PropTypes.func,
  deactivate: PropTypes.func,
  playerMap: ImmutablePropTypes.map,
  team: PropTypes.object
}
