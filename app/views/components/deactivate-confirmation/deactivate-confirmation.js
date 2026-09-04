import React, { useState, useEffect } from 'react'
import { List } from 'immutable'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'

import Modal from '@components/modal'
import Button from '@components/button'
import { acquisition_transaction_types, transaction_types } from '#constants'

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
      // Only release when the dialog actually asked for one. The selector is
      // hidden the moment space is available, and `isDraftedRookie` can now go
      // from false to true mid-dialog when the player's transactions finish
      // loading -- so a selection made against the empty initial list must not
      // ride along and drop a player nobody chose to drop.
      release_pid: hasPracticeSquadSpace ? '' : release_pid
    })

    onClose()
  }

  const player_transactions = player_map.get('transactions', new List())

  // Mirrors submit-deactivate.mjs, which exempts a drafted rookie from needing
  // practice squad space. Its rule is "a DRAFT among the transactions since
  // this team acquired the player", and since DRAFT is itself an acquisition
  // type, that holds exactly when the most recent acquisition WAS the draft.
  //
  // This was `Boolean(player_transactions.filter(...))`, which is true for
  // EVERY player: filter returns a List, and every object is truthy. So
  // isDraftedRookie was never false, hasPracticeSquadSpace was never false --
  // `hasOpenPracticeSquadSlot()` was never even called, being short-circuited
  // past -- and both branches below were unreachable. A manager with a full
  // practice squad got no warning, no release selector, and a server rejection
  // they had no way to act on.
  //
  // The route sends these newest-first, the same order the server slices in.
  const most_recent_acquisition = player_transactions.find(
    (t) =>
      t.tid === team.roster.tid &&
      acquisition_transaction_types.includes(t.type)
  )
  const isDraftedRookie =
    most_recent_acquisition?.type === transaction_types.DRAFT
  const hasPracticeSquadSpace =
    isDraftedRookie || team.roster.hasOpenPracticeSquadSlot()

  const releaseItems = []
  for (const { pid } of team.roster.practice_signed) {
    const release_player_map = team.players.find(
      (player_map) => player_map.get('pid') === pid
    )
    releaseItems.push(
      <MenuItem key={pid} value={pid}>
        {release_player_map.get('name')} (
        {release_player_map.get('primary_position')})
      </MenuItem>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title='Deactivate Player'
      actions={
        <>
          <Button onClick={onClose} text>
            Cancel
          </Button>
          <Button onClick={handleSubmit} text>
            Confirm
          </Button>
        </>
      }
    >
      <p>
        {`${player_map.get('first_name')} ${player_map.get('last_name')} (${player_map.get('primary_position')}) will be placed on the practice squad. He will not be available to use in lineups until he's reactivated.`}
      </p>
      {!hasPracticeSquadSpace && (
        <p>
          No practice squad space available, make room by releasing a signed
          practice squad player
        </p>
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
    </Modal>
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
