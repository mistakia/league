import React from 'react'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'
import InputAdornment from '@material-ui/core/InputAdornment'
import TextField from '@material-ui/core/TextField'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'

import Button from '@components/button'
import { Roster, constants } from '@common'

import './waiver-confirmation.styl'

export default class WaiverConfirmation extends React.Component {
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
    this.state = { drop: drops.length ? drops[0].player : undefined, bid: 0, error: false }
  }

  handleDrop = (event) => {
    const { value } = event.target
    this.setState({ drop: value })
  }

  handleBid = (event) => {
    const { value } = event.target

    if (isNaN(value) || value % 1 !== 0) {
      this.setState({ error: true })
    } else if (value < 0 || value > this.props.team.faab) {
      this.setState({ error: true })
    } else {
      this.setState({ error: false })
    }

    this.setState({ bid: value })
  }

  handleSubmit = () => {
    const { bid, drop, error } = this.state
    const player = this.props.player.player
    if (!error) {
      this.props.claim({ bid, drop, player, type: constants.waivers.ADD })
      this.props.onClose()
    }
  }

  render = () => {
    const { isEligible, team, player } = this.props

    const menuItems = []
    if (!isEligible) {
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
        <DialogTitle>Waiver Claim</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Add ${player.name} (${player.pos1})`}
          </DialogContentText>
          <div className='waiver__claim-inputs'>
            <TextField
              label='Bid'
              helperText={`Max Bid: ${team.faab}`}
              error={this.state.error}
              value={this.state.bid}
              onChange={this.handleBid}
              InputProps={{
                startAdornment: <InputAdornment position='start'>$</InputAdornment>
              }}
              size='small'
              variant='outlined'
            />
            {!isEligible &&
              <FormControl size='small' variant='outlined'>
                <InputLabel id='drop-label'>Drop</InputLabel>
                <Select
                  labelId='drop-label'
                  value={this.state.drop}
                  onChange={this.handleDrop}
                  label='Drop'
                >
                  {menuItems}
                </Select>
              </FormControl>}
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
