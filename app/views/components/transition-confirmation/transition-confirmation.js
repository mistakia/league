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

    const { team, playerMap } = props

    this.state = {
      releaseIds: [],
      untag: '',
      bid: playerMap.get('bid', 0),
      error: false,
      missingRelease: false,
      missingUntag: false
    }

    this._untags = []
    const tagged_players = team.roster.getPlayersByTag(
      constants.tags.TRANSITION
    )
    const tagged_pids = tagged_players.map((p) => p.pid)
    for (const pid of tagged_pids) {
      const playerMap = team.players.find(
        (playerMap) => playerMap.get('pid') === pid
      )
      this._untags.push(playerMap)
    }

    const pid = playerMap.get('pid')
    this._isUpdate = Boolean(tagged_pids.includes(pid) || playerMap.get('bid'))
    this._isOriginalTeam = team.roster.tid === playerMap.get('tid')
    // TODO - check roster size limit eligiblity
    this._isEligible =
      this._isUpdate ||
      !this._isOriginalTeam ||
      team.roster.isEligibleForTag({
        tag: constants.tags.TRANSITION
      })
  }

  getMaxBid = () => {
    const availableSalary = this.props.team.roster.availableCap
    const { isBeforeExtensionDeadline, playerMap, league, cutlistTotalSalary } =
      this.props
    const value = playerMap.get('value', 0)
    const bid = playerMap.get('bid', 0)
    const extensions = this.props.playerMap.get('extensions', 0)
    const playerSalary = isBeforeExtensionDeadline
      ? getExtensionAmount({
          pos: playerMap.get('pos'),
          tag: playerMap.get('tag'),
          extensions,
          league,
          value,
          bid
        })
      : bid || value

    const notInCutlist = this.state.releaseIds.filter(
      (pid) => !this.props.cutlist.includes(pid)
    )
    const releaseTotalSalary = notInCutlist.reduce((sum, pid) => {
      const playerMap = this.props.team.players.find(
        (playerMap) => playerMap.get('pid') === pid
      )
      const value = playerMap.get('value', 0)
      const bid = playerMap.get('bid', 0)
      const extensions = playerMap.get('extensions', 0)
      const salary = isBeforeExtensionDeadline
        ? getExtensionAmount({
            pos: playerMap.get('pos'),
            tag: playerMap.get('tag'),
            extensions,
            league,
            value,
            bid
          })
        : value

      return sum + salary
    }, 0)

    const salarySpaceTotal =
      availableSalary + cutlistTotalSalary + releaseTotalSalary
    const onCutlist = this.props.cutlist.includes(playerMap.get('pid'))
    return (
      salarySpaceTotal + (this._isOriginalTeam && !onCutlist ? playerSalary : 0)
    )
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
    const pids = value.map((p) => p.id)
    this.setState({ releaseIds: pids })
  }

  handleUntag = (event) => {
    const { value } = event.target
    this.setState({ untag: value, missingUntag: false })
  }

  handleSubmit = () => {
    const { untag, error, bid } = this.state
    const { tid } = this.props.team.roster
    const pid = this.props.playerMap.get('pid')
    const playerTid = this.props.playerMap.get('tid')

    if (!this._isEligible && !untag) {
      return this.setState({ missingUntag: true })
    } else {
      this.setState({ missingUntag: false })
    }

    if (!error) {
      const data = {
        pid,
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
    const { team, playerMap, league } = this.props

    const menuItems = []
    for (const rPlayerMap of this._untags) {
      const pid = rPlayerMap.get('pid')
      menuItems.push(
        <MenuItem key={pid} value={pid}>
          {rPlayerMap.get('name')} ({rPlayerMap.get('pos')})
        </MenuItem>
      )
    }

    const options = []
    const pid = playerMap.get('pid')
    team.players.forEach((playerMap) => {
      const pid_i = playerMap.get('pid')
      if (pid_i === pid) {
        return
      }

      const pos = playerMap.get('pos')
      const extensions = playerMap.get('extensions', new List()).size
      const salary = getExtensionAmount({
        pos,
        tag: playerMap.get('tag'),
        extensions,
        league,
        value: playerMap.get('value'),
        bid: playerMap.get('bid')
      })
      options.push({
        id: pid_i,
        label: playerMap.get('name'),
        pos,
        team: playerMap.get('team'),
        pname: playerMap.get('pname'),
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
    this.state.releaseIds.forEach((pid) => {
      const playerMap = this.props.team.players.find(
        (playerMap) => playerMap.get('pid') === pid
      )
      releasePlayers.push({
        id: playerMap.get('pid'),
        label: playerMap.get('name'),
        pos: playerMap.get('pos'),
        team: playerMap.get('team'),
        pname: playerMap.get('pname'),
        value: playerMap.get('value')
      })
    })

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Transition Tag</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Place Transition bid on ${playerMap.get('name')} (${playerMap.get(
              'pos'
            )})`}
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
                  label='Remove Tag'
                >
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
  playerMap: ImmutablePropTypes.map,
  cutlistTotalSalary: PropTypes.number,
  cutlist: ImmutablePropTypes.list,
  addTransitionTag: PropTypes.func,
  updateTransitionTag: PropTypes.func,
  isBeforeExtensionDeadline: PropTypes.bool
}
