import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import FormControl from '@material-ui/core/FormControl'
import MenuItem from '@material-ui/core/MenuItem'
import InputLabel from '@material-ui/core/InputLabel'
import Select from '@material-ui/core/Select'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'

import Button from '@components/button'
import { constants, isReserveEligible } from '@common'

export default class ActivateConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      reserve: '',
      release: '',
      missing: false
    }

    const { team, player } = props
    this._hasBenchSpace = team.roster.hasOpenBenchSlot(player.pos)
    this._reserveEligible = []
    this._activePlayers = []

    const activePlayerIds = team.roster.active.map((p) => p.player)
    for (const playerId of activePlayerIds) {
      const player = team.players.find((p) => p.player === playerId)
      this._activePlayers.push(player)
      if (isReserveEligible(player)) {
        this._reserveEligible.push(player)
      }
    }
  }

  handleSelectReserve = (event) => {
    const { value } = event.target
    this.setState({ reserve: value, missing: false })
  }

  handleSelectRelease = (event) => {
    const { value } = event.target
    this.setState({ release: value, missing: false })
  }

  handleSubmit = () => {
    const { reserve, release } = this.state
    const { player } = this.props.player

    if (!this._hasBenchSpace && !reserve && !release) {
      return this.setState({ missing: true })
    } else {
      this.setState({ missing: false })
    }

    this.props.activate({ player, reserve, release, slot: constants.slots.IR })
    this.props.onClose()
  }

  render = () => {
    const { player } = this.props

    const reserveItems = []
    for (const rPlayer of this._reserveEligible) {
      reserveItems.push(
        <MenuItem key={rPlayer.player} value={rPlayer.player}>
          {rPlayer.name} ({rPlayer.pos})
        </MenuItem>
      )
    }

    const releaseItems = []
    for (const rPlayer of this._activePlayers) {
      releaseItems.push(
        <MenuItem key={rPlayer.player} value={rPlayer.player}>
          {rPlayer.name} ({rPlayer.pos})
        </MenuItem>
      )
    }

    const isReservePlayer = player.slot === constants.slots.IR
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
            {`${player.fname} ${player.lname} (${player.pos}) will be placed on the active roster. If the player was not previously activated, activating them will make them ineligible for the practice squad.`}
          </DialogContentText>
          {!this._hasBenchSpace && (
            <DialogContentText>{noBenchSpaceMessage}</DialogContentText>
          )}
          <div className='waiver__claim-inputs'>
            {isReservePlayer &&
              !this._hasBenchSpace &&
              Boolean(reserveItems.length) && (
                <FormControl size='small' variant='outlined'>
                  <InputLabel id='reserve-label'>Reserve</InputLabel>
                  <Select
                    labelId='reserve-label'
                    error={this.state.missing}
                    value={this.state.reserve}
                    onChange={this.handleSelectReserve}
                    label='Reserve'>
                    {reserveItems}
                  </Select>
                </FormControl>
              )}
          </div>
          <div className='waiver__claim-inputs'>
            {!this._hasBenchSpace && (
              <FormControl size='small' variant='outlined'>
                <InputLabel id='release-label'>Release</InputLabel>
                <Select
                  labelId='release-label'
                  error={this.state.missing}
                  value={this.state.release}
                  onChange={this.handleSelectRelease}
                  label='Release'>
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
  player: ImmutablePropTypes.record,
  team: PropTypes.object
}
