import React from 'react'
import { List } from 'immutable'
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
import { constants, getExtensionAmount } from '@common'

import './transition-confirmation.styl'

export default class TransitionConfirmation extends React.Component {
  constructor(props) {
    super(props)

    const { team, player } = props

    this.state = {
      releaseIds: [],
      untag: '',
      bid: player.bid || 0,
      error: false,
      missingRelease: false,
      missingUntag: false
    }

    this._untags = []
    const taggedPlayers = team.roster.getPlayersByTag(constants.tags.TRANSITION)
    const taggedPlayerIds = taggedPlayers.map((p) => p.player)
    for (const playerId of taggedPlayerIds) {
      const player = team.players.find((p) => p.player === playerId)
      this._untags.push(player)
    }

    this._isUpdate = taggedPlayerIds.includes(player.player) || player.bid
    this._isOriginalTeam = team.roster.tid === player.tid
    // TODO - check roster size limit eligiblity
    this._isEligible =
      this._isUpdate ||
      !this._isOriginalTeam ||
      team.roster.isEligibleForTag({
        tag: constants.tags.TRANSITION,
        player: player.player
      })
  }

  getMaxBid = () => {
    const available = this.props.team.roster.availableCap
    const { isBeforeExtensionDeadline } = this.props
    const { pos, tag, value, bid } = this.props.player
    const extensions = this.props.player.get('extensions', new List()).size
    const { league, cutlistTotalSalary } = this.props
    const playerSalary = isBeforeExtensionDeadline
      ? getExtensionAmount({
          pos,
          tag,
          extensions,
          league,
          value,
          bid
        })
      : bid || value

    const notInCutlist = this.state.releaseIds.filter(
      (playerId) => !this.props.cutlist.includes(playerId)
    )
    const releaseSalary = notInCutlist.reduce((sum, playerId) => {
      const player = this.props.team.players.find((p) => p.player === playerId)
      const { pos, value, tag, bid } = player
      const extensions = player.get('extensions', new List()).size
      const salary = isBeforeExtensionDeadline
        ? getExtensionAmount({
            pos,
            tag,
            extensions,
            league,
            value,
            bid
          })
        : value

      return sum + salary
    }, 0)

    const space = available + cutlistTotalSalary + releaseSalary
    return space + (this._isOriginalTeam ? playerSalary : 0)
  }

  handleBid = (event) => {
    const { value } = event.target

    if (isNaN(value) || value % 1 !== 0) {
      this.setState({ error: true })
    } else if (value < 0) {
      this.setState({ error: true })
    } else {
      this.setState({ error: false })
    }

    this.setState({ bid: value })
  }

  handleRelease = (event, value) => {
    const playerIds = value.map((p) => p.id)
    this.setState({ releaseIds: playerIds })
  }

  handleUntag = (event) => {
    const { value } = event.target
    this.setState({ untag: value, missingUntag: false })
  }

  handleSubmit = () => {
    const { untag, error, bid } = this.state
    const { tid } = this.props.team.roster
    const player = this.props.player.player
    const playerTid = this.props.player.tid

    if (!this._isEligible && !untag) {
      return this.setState({ missingUntag: true })
    } else {
      this.setState({ missingUntag: false })
    }

    if (!error) {
      const data = {
        player,
        release: this.state.releaseIds,
        playerTid,
        teamId: tid,
        bid: parseInt(bid, 10),
        remove: untag
      }

      if (this._isUpdate) {
        this.props.updateTransitionTag(data)
      } else {
        this.props.addTransitionTag(data)
      }

      this.props.onClose()
    }
  }

  render = () => {
    const { team, player, league } = this.props

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
      if (player.player === this.props.player.player) {
        return
      }

      const { pos, team, pname, value, name, tag, bid } = player
      const extensions = player.get('extensions', new List()).size
      const salary = getExtensionAmount({
        pos,
        tag,
        extensions,
        league,
        value,
        bid
      })
      options.push({
        id: player.player,
        label: name,
        pos,
        team,
        pname,
        value: salary
      })
    })
    const getOptionSelected = (option, value) => option.id === value.id
    const renderOption = (option) => {
      return (
        <div className='release__select-player'>
          <div className='release__select-player-value'>${option.value}</div>
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
    const title = 'Select players to conditionally release'
    const renderInput = (params) => (
      <TextField
        {...params}
        variant='outlined'
        label={title}
        placeholder={title}
      />
    )
    const releasePlayers = []
    this.state.releaseIds.forEach((playerId) => {
      const player = this.props.team.players.find((p) => p.player === playerId)
      const { pos, team, pname, value, name } = player
      releasePlayers.push({
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
          <div className='transition__bid-inputs'>
            <TextField
              label='Bid'
              helperText={`Max Bid: ${this.getMaxBid()}`}
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
              value={releasePlayers}
              onChange={this.handleRelease}
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
  player: ImmutablePropTypes.record,
  cutlistTotalSalary: PropTypes.number,
  cutlist: ImmutablePropTypes.list,
  addTransitionTag: PropTypes.func,
  updateTransitionTag: PropTypes.func,
  isBeforeExtensionDeadline: PropTypes.bool
}
