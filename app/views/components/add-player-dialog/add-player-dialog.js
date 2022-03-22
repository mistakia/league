import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import InputAdornment from '@material-ui/core/InputAdornment'
import TextField from '@material-ui/core/TextField'
import DialogContent from '@material-ui/core/DialogContent'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'

import { Roster } from '@common'
import Button from '@components/button'

import './add-player-dialog.styl'

export default class AddPlayerDialog extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      player: undefined,
      value: 0,
      error: false
    }
  }

  getAvailableCap = () => {
    const { rosters, league, team } = this.props
    const rosterData = rosters.find((r) => r.tid === team.uid)
    const roster = new Roster({ roster: rosterData.toJS(), league })
    return roster.availableCap
  }

  handleChangeValue = (event) => {
    const { value } = event.target

    if (isNaN(value) || value % 1 !== 0) {
      this.setState({ error: true })
    } else if (value < 0 || value > this.getAvailableCap()) {
      this.setState({ error: true })
    } else {
      this.setState({ error: false })
    }

    this.setState({ value })
  }

  handleChangePlayer = (event) => {
    const { value } = event.target
    this.setState({ player: value })
  }

  handleSubmit = () => {
    const { value, player, error } = this.state
    const { team } = this.props
    if (!error && player) {
      this.props.add({
        player,
        value,
        teamId: team.uid
      })
    }
    this.props.onClose()
  }

  render = () => {
    const { players } = this.props

    const sorted = players.sortBy((player) => player.name)
    const menuItems = [<option key='default' value='' />]
    for (const [index, player] of sorted.entries()) {
      menuItems.push(
        <option key={index} value={player.player}>
          {player.name} ({player.pos})
        </option>
      )
    }

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Add Player To Roster</DialogTitle>
        <DialogContent>
          <div className='add__player-dialog'>
            <FormControl size='small' variant='outlined'>
              <InputLabel id='player'>Player</InputLabel>
              <Select
                native
                value={this.state.player}
                onChange={this.handleChangePlayer}
                label='Player'
              >
                {menuItems}
              </Select>
            </FormControl>
            <TextField
              label='Value'
              helperText={`Max: ${this.getAvailableCap()}`}
              error={this.state.error}
              value={this.state.value}
              onChange={this.handleChangeValue}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>$</InputAdornment>
                )
              }}
              size='small'
              variant='outlined'
            />
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

AddPlayerDialog.propTypes = {
  rosters: ImmutablePropTypes.map,
  league: PropTypes.object,
  team: ImmutablePropTypes.record,
  add: PropTypes.func,
  onClose: PropTypes.func,
  players: ImmutablePropTypes.map
}
