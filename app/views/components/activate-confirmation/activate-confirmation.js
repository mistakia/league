import React from 'react'
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
import { constants, isReserveEligible } from '@libs-shared'

export default class ActivateConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      reserve_pid: '',
      release_pid: '',
      missing: false
    }

    const { team, playerMap } = props
    this._hasBenchSpace = team.roster.hasOpenBenchSlot(playerMap.get('pos'))
    this._reserveEligible = []
    this._activePlayers = []

    const active_pids = team.roster.active.map((p) => p.pid)
    for (const pid of active_pids) {
      const activePlayerMap = team.players.find(
        (playerMap) => playerMap.get('pid') === pid
      )
      this._activePlayers.push(activePlayerMap)
      if (
        isReserveEligible({
          status: activePlayerMap.get('status'),
          injury_status: activePlayerMap.get('injury_status')
        })
      ) {
        this._reserveEligible.push(activePlayerMap)
      }
    }
  }

  handleSelectReserve = (event) => {
    const { value } = event.target
    this.setState({ reserve_pid: value, missing: false })
  }

  handleSelectRelease = (event) => {
    const { value } = event.target
    this.setState({ release_pid: value, missing: false })
  }

  handleSubmit = () => {
    const { reserve_pid, release_pid } = this.state
    const activate_pid = this.props.playerMap.get('pid')

    if (!this._hasBenchSpace && !reserve_pid && !release_pid) {
      return this.setState({ missing: true })
    } else {
      this.setState({ missing: false })
    }

    this.props.activate({
      activate_pid,
      reserve_pid,
      release_pid,
      slot: constants.slots.IR
    })
    this.props.onClose()
  }

  render = () => {
    const { playerMap } = this.props

    const reserveItems = []
    for (const reservePlayerMap of this._reserveEligible) {
      const pid = reservePlayerMap.get('pid')
      reserveItems.push(
        <MenuItem key={pid} value={pid}>
          {reservePlayerMap.get('name')} ({reservePlayerMap.get('pos')})
        </MenuItem>
      )
    }

    const releaseItems = []
    for (const activePlayerMap of this._activePlayers) {
      const pid = activePlayerMap.get('pid')
      releaseItems.push(
        <MenuItem key={pid} value={pid}>
          {activePlayerMap.get('name')} ({activePlayerMap.get('pos')})
        </MenuItem>
      )
    }

    const isReservePlayer = playerMap.get('slot') === constants.slots.IR
    let noBenchSpaceMessage =
      'No active roster space available, make room by releasing a player'
    if (isReservePlayer)
      noBenchSpaceMessage +=
        ' or moving any reserve eligible players to reserve.'

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Activate Player</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`${playerMap.get('fname')} ${playerMap.get(
              'lname'
            )} (${playerMap.get(
              'pos'
            )}) will be placed on the active roster. If the player was not previously activated, activating them will make them ineligible for the practice squad.`}
          </DialogContentText>
          {!this._hasBenchSpace && (
            <DialogContentText>{noBenchSpaceMessage}</DialogContentText>
          )}
          <div className='confirmation__inputs'>
            {isReservePlayer &&
              !this._hasBenchSpace &&
              Boolean(reserveItems.length) && (
                <FormControl size='small' variant='outlined'>
                  <InputLabel id='reserve-label'>Reserve</InputLabel>
                  <Select
                    labelId='reserve-label'
                    error={this.state.missing}
                    value={this.state.reserve_pid}
                    onChange={this.handleSelectReserve}
                    label='Reserve'
                  >
                    {reserveItems}
                  </Select>
                </FormControl>
              )}
          </div>
          <div className='confirmation__inputs'>
            {!this._hasBenchSpace && (
              <FormControl size='small' variant='outlined'>
                <InputLabel id='release-label'>Release</InputLabel>
                <Select
                  labelId='release-label'
                  error={this.state.missing}
                  value={this.state.release_pid}
                  onChange={this.handleSelectRelease}
                  label='Release'
                >
                  {releaseItems}
                </Select>
              </FormControl>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.props.onClose} text>
            Cancel
          </Button>
          <Button onClick={this.handleSubmit} text>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

ActivateConfirmation.propTypes = {
  onClose: PropTypes.func,
  activate: PropTypes.func,
  playerMap: ImmutablePropTypes.map,
  team: PropTypes.object
}
