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

    const { waiver } = props
    this._isEligible = false
    this._drops = []
    this.state = {
      drop: waiver ? waiver.drop : '',
      type: waiver ? waiver.type : '',
      bid: waiver ? waiver.bid : 0,
      error: false,
      missingType: false,
      missingDrop: false
    }

    if (waiver) this._setType(waiver.type)
  }

  _setType = (type) => {
    const isActiveRoster = type === constants.waivers.FREE_AGENCY
    const { league, player, roster, rosterPlayers } = this.props

    const ros = new Roster({ roster: roster.toJS(), league })
    this._isEligible = isActiveRoster
      ? ros.hasOpenBenchSlot(player.pos1)
      : ros.hasOpenPracticeSquadSlot()

    const drops = []
    const players = isActiveRoster
      ? rosterPlayers.active
      : rosterPlayers.practice

    for (const rPlayer of players) {
      const r = new Roster({ roster: roster.toJS(), league })
      r.removePlayer(rPlayer.player)
      if (isActiveRoster) {
        if (r.hasOpenBenchSlot(player.pos1)) drops.push(rPlayer)
      } else {
        if (r.hasOpenPracticeSquadSlot()) drops.push(rPlayer)
      }
    }

    this._drops = drops
  }

  handleDrop = (event) => {
    const { value } = event.target
    this.setState({ drop: value, missingDrop: false })
  }

  handleType = (event) => {
    const { value } = event.target
    this.setState({ type: value, drop: '', missingType: false })
    this._setType(value)
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
    const { bid, drop, error, type } = this.state
    const player = this.props.player.player

    if (!type) {
      return this.setState({ missingType: true })
    } else {
      this.setState({ missingType: false })
    }

    if (!this._isEligible && !drop) {
      return this.setState({ missingDrop: true })
    } else {
      this.setState({ missingDrop: false })
    }

    if (!error) {
      if (this.props.waiver) {
        this.props.update({ waiverId: this.props.waiver.uid, drop, bid })
      } else {
        this.props.claim({ bid, drop, type, player })
      }
      this.props.onClose()
    }
  }

  render = () => {
    const { team, player, status, waiver } = this.props

    const menuItems = []
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

    const typeItems = []
    if ((waiver && waiver.type === constants.waivers.FREE_AGENCY_PRACTICE) || status.waiver.practice) {
      typeItems.push(
        <MenuItem
          key='practice'
          value={constants.waivers.FREE_AGENCY_PRACTICE}
        >
          Practice Squad
        </MenuItem>
      )
    }

    if ((waiver && waiver.type === constants.waivers.FREE_AGENCY) || status.waiver.active) {
      typeItems.push(
        <MenuItem
          key='active'
          value={constants.waivers.FREE_AGENCY}
        >
          Active Roster
        </MenuItem>
      )
    }

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Waiver Claim</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Add ${player.name} (${player.pos1})`}
          </DialogContentText>
          <div className='waiver__claim-inputs'>
            {this.state.type === constants.waivers.FREE_AGENCY &&
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
              />}
            <FormControl size='small' variant='outlined'>
              <InputLabel id='type-label'>Type</InputLabel>
              <Select
                labelId='type-label'
                error={this.state.missingType}
                value={this.state.type}
                disabled={Boolean(waiver)}
                onChange={this.handleType}
                label='Type'
              >
                {typeItems}
              </Select>
            </FormControl>
            {(this.state.type) &&
              <FormControl size='small' variant='outlined'>
                <InputLabel id='drop-label'>Drop</InputLabel>
                <Select
                  labelId='drop-label'
                  error={this.state.missingDrop}
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
