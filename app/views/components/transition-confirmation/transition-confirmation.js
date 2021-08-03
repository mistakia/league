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
import InputAdornment from '@material-ui/core/InputAdornment'
import TextField from '@material-ui/core/TextField'
import Autocomplete from '@material-ui/lab/Autocomplete'
import Chip from '@material-ui/core/Chip'

import Position from '@components/position'
import Team from '@components/team'
import Button from '@components/button'
import { constants } from '@common'

import './transition-confirmation.styl'

export default class TransitionConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      dropIds: [],
      untag: '',
      bid: 0,
      error: false,
      missingDrop: false,
      missingUntag: false
    }

    const { team, player } = props
    this._isEligible = team.roster.isEligibleForTag({
      tag: constants.tags.TRANSITION,
      player: player.player
    })
    this._untags = []
    const taggedPlayers = team.roster.getPlayersByTag(constants.tags.TRANSITION)
    const taggedPlayerIds = taggedPlayers.map((p) => p.player)
    for (const playerId of taggedPlayerIds) {
      const player = team.players.find((p) => p.player === playerId)
      this._untags.push(player)
    }
  }

  handleBid = (event) => {
    const { value } = event.target

    const maxBid = this.props.team.roster.availableCap

    if (isNaN(value) || value % 1 !== 0) {
      this.setState({ error: true })
    } else if (value < 0 || value > maxBid) {
      this.setState({ error: true })
    } else {
      this.setState({ error: false })
    }

    this.setState({ bid: value })
  }

  handleDrop = (event, value) => {
    const playerIds = value.map((p) => p.id)
    this.setState({ dropIds: playerIds })
  }

  handleUntag = (event) => {
    const { value } = event.target
    this.setState({ untag: value, missingUntag: false })
  }

  handleSubmit = () => {
    const { untag, error } = this.state
    // const player = this.props.player.player

    if (!this._isEligible && !untag) {
      return this.setState({ missingUntag: true })
    } else {
      this.setState({ missingUntag: false })
    }

    if (!error) {
      // broadcast
      this.props.onClose()
    }
  }

  render = () => {
    const { team, player } = this.props

    const menuItems = []
    for (const rPlayer of this._untags) {
      menuItems.push(
        <MenuItem key={rPlayer.player} value={rPlayer.player}>
          {rPlayer.name} ({rPlayer.pos})
        </MenuItem>
      )
    }

    const options = []
    team.players.forEach((player) => {
      const { pos, team, pname, value, name } = player
      options.push({ id: player.player, label: name, pos, team, pname, value })
    })
    const getOptionSelected = (option, value) => option.id === value.id
    const renderOption = (option) => {
      return (
        <div className='drop__select-player'>
          <div className='drop__select-player-value'>${option.value}</div>
          <div className='player__name-position'>
            <Position pos={option.pos} />
          </div>
          <div className='player__name-main'>
            <span>{option.pname}</span>
            <Team team={option.team} />
          </div>
        </div>
      )
    }
    const renderTags = (value, getTagProps) =>
      value.map((option, index) => (
        // eslint-disable-next-line
        <Chip label={option.label} {...getTagProps({ index })} />
      ))
    const title = 'Select players to conditionally drop'
    const renderInput = (params) => (
      <TextField
        {...params}
        variant='outlined'
        label={title}
        placeholder={title}
      />
    )
    const dropPlayers = []
    this.state.dropIds.forEach((playerId) => {
      const player = this.props.team.players.find((p) => p.player === playerId)
      const { pos, team, pname, value, name } = player
      dropPlayers.push({
        id: player.player,
        label: name,
        pos,
        team,
        pname,
        value
      })
    })

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Transition Tag</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Apply Transition Tag to ${player.name} (${player.pos})`}
          </DialogContentText>
          <div className='waiver__claim-inputs'>
            <TextField
              label='Bid'
              helperText={`Max Bid: ${team.roster.availableCap}`}
              error={this.state.error}
              value={this.state.bid}
              onChange={this.handleBid}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>$</InputAdornment>
                )
              }}
              size='small'
              variant='outlined'
            />
            {!this._isEligible && (
              <FormControl size='small' variant='outlined'>
                <InputLabel id='untag-label'>Remove Tag</InputLabel>
                <Select
                  labelId='untag-label'
                  error={this.state.missingUntag}
                  value={this.state.untag}
                  onChange={this.handleUntag}
                  label='Remove Tag'>
                  {menuItems}
                </Select>
              </FormControl>
            )}
            <Autocomplete
              multiple
              options={options}
              getOptionLabel={(x) => x.label}
              getOptionSelected={getOptionSelected}
              renderOption={renderOption}
              filterSelectedOptions
              value={dropPlayers}
              onChange={this.handleDrop}
              renderTags={renderTags}
              renderInput={renderInput}
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

TransitionConfirmation.propTypes = {
  onClose: PropTypes.func,
  team: PropTypes.object,
  league: PropTypes.object,
  player: ImmutablePropTypes.record
}
