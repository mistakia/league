import React from 'react'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'

import Button from '@components/button'
import { Roster, constants } from '@common'

export default class PoachConfirmation extends React.Component {
  constructor (props) {
    super(props)

    const drops = []
    const { league, player } = props
    for (const rPlayer of props.rosterPlayers.active) {
      const r = new Roster({ roster: props.roster.toJS(), league })
      r.removePlayer(rPlayer.player)
      if (r.hasOpenBenchSlot(player.pos1)) {
        drops.push(rPlayer)
      }
    }

    this._drops = drops
    this.state = { drop: undefined, error: false }
  }

  handleDrop = (event) => {
    const { value } = event.target
    this.setState({ drop: value })
  }

  handleSubmit = () => {
    const { isPlayerEligible } = this.props

    const player = this.props.player.player
    const { drop } = this.state

    if (!isPlayerEligible && !drop) {
      return this.setState({ error: true })
    } else {
      this.setState({ error: false })
    }

    if (this.props.status.waiver.poach) {
      this.props.claim({ drop, player, type: constants.waivers.POACH })
    } else {
      this.props.poach({ drop, player })
    }
    this.props.onClose()
  }

  render = () => {
    const { isPlayerEligible, rosterInfo, player, status } = this.props

    const menuItems = []
    if (!isPlayerEligible) {
      for (const rPlayer of this._drops) {
        menuItems.push(
          <MenuItem
            key={rPlayer.player}
            value={rPlayer.player}
          >
            {rPlayer.name} ({rPlayer.pos1})
          </MenuItem>
        )
      }
    }

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>{status.waiver.poach
          ? 'Poaching Waiver Claim'
          : 'Poaching Claim'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Poach ${player.name} (${player.pos1}). His keeper value will become $${rosterInfo.value + 2}. If your claim is successful, he will be added to your active roster and will not be eligible for the practice squad.`}
          </DialogContentText>
          <DialogContentText>
            {status.waiver.poach
              ? 'This is a waiver claim and can be cancelled anytime before it\'s processed.'
              : 'This is a poaching claim and can not be cancelled once submitted.'}
          </DialogContentText>
          {!isPlayerEligible &&
            <DialogContentText>
              There is not enough space on your active roster. Please select a player to drop. They will only be dropped if your claim is successful.
            </DialogContentText>}
          {!isPlayerEligible &&
            <FormControl size='small' variant='outlined'>
              <InputLabel id='drop-label'>Drop</InputLabel>
              <Select
                labelId='drop-label'
                value={this.state.drop}
                error={this.state.error}
                onChange={this.handleDrop}
                label='Drop'
              >
                {menuItems}
              </Select>
            </FormControl>}
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
