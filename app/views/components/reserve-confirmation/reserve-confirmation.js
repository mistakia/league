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
import { constants } from '@common'

export default class ReserveConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      activate: '',
      missingActivate: false
    }

    const { team } = props
    this._hasReserveSpace = team.roster.hasOpenInjuredReserveSlot()
    this._activatable = []

    const reservePlayerIds = team.roster.reserve.map((p) => p.player)
    for (const playerId of reservePlayerIds) {
      const player = team.players.find((p) => p.player === playerId)
      this._activatable.push(player)
    }
  }

  handleSelectActivate = (event) => {
    const { value } = event.target
    this.setState({ activate: value, missingActivate: false })
  }

  handleSubmit = () => {
    const { activate } = this.state
    const { player } = this.props.player

    if (!this._hasReserveSpace && !activate) {
      return this.setState({ missingActivate: true })
    } else {
      this.setState({ missingActivate: false })
    }

    this.props.reserve({ player, slot: constants.slots.IR, activate })
    this.props.onClose()
  }

  render = () => {
    const { player } = this.props

    const menuItems = []
    for (const rPlayer of this._activatable) {
      menuItems.push(
        <MenuItem key={rPlayer.player} value={rPlayer.player}>
          {rPlayer.name} ({rPlayer.pos})
        </MenuItem>
      )
    }

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Designate Reserve</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`${player.fname} ${player.lname} (${player.pos}) will be placed on Reserves/IR. He will not be available to use in lineups until he's activated.`}
          </DialogContentText>
          {!this._hasReserveSpace && (
            <DialogContentText>
              No reserve space available, make room by activating a player from
              reserve.
            </DialogContentText>
          )}
          <div className='waiver__claim-inputs'>
            {!this._hasReserveSpace && (
              <FormControl size='small' variant='outlined'>
                <InputLabel id='activate-label'>Activate</InputLabel>
                <Select
                  labelId='activate-label'
                  error={this.state.missingActivate}
                  value={this.state.activate}
                  onChange={this.handleSelectActivate}
                  label='Activate'>
                  {menuItems}
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

ReserveConfirmation.propTypes = {
  onClose: PropTypes.func,
  reserve: PropTypes.func,
  player: ImmutablePropTypes.record,
  team: PropTypes.object
}
