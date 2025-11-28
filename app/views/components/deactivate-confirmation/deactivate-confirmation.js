import React, { useState, useEffect } from 'react'
import { List } from 'immutable'
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
import { current_season, transaction_types } from '@constants'

export default function DeactivateConfirmation({
  onClose,
  deactivate,
  player_map,
  team,
  pid,
  load_player_transactions
}) {
  const [release_pid, set_release_pid] = useState('')

  useEffect(() => {
    load_player_transactions(pid)
  }, [load_player_transactions, pid])

  const handleSelectRelease = (event) => {
    const { value } = event.target
    set_release_pid(value)
  }

  const handleSubmit = () => {
    const deactivate_pid = player_map.get('pid')

    deactivate({
      deactivate_pid,
      release_pid
    })

    onClose()
  }

  const player_transactions = player_map.get('transactions', new List())
  const isDraftedRookie = Boolean(
    player_transactions.filter(
      (t) =>
        t.type === transaction_types.DRAFT && t.year === current_season.year
    )
  )
  const hasPracticeSquadSpace =
    isDraftedRookie || team.roster.hasOpenPracticeSquadSlot()

  const releaseItems = []
  for (const { pid } of team.roster.practice_signed) {
    const release_player_map = team.players.find(
      (player_map) => player_map.get('pid') === pid
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
          {`${player_map.get('fname')} ${player_map.get(
            'lname'
          )} (${player_map.get(
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
  player_map: ImmutablePropTypes.map,
  team: PropTypes.object,
  load_player_transactions: PropTypes.func,
  pid: PropTypes.string
}
