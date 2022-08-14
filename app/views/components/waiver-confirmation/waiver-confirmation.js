import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'
import Autocomplete from '@mui/material/Autocomplete'
import Chip from '@mui/material/Chip'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import Button from '@components/button'
import { Roster, constants, getExtensionAmount } from '@common'

import './waiver-confirmation.styl'

export default class WaiverConfirmation extends React.Component {
  constructor(props) {
    super(props)

    const { waiver } = props
    this._isEligible = false
    this._releases = []
    this.state = {
      release: waiver ? waiver.release.toJS() : [],
      type: waiver ? waiver.type : '',
      bid: waiver ? waiver.bid : 0,
      error: false,
      missingType: false,
      missingRelease: false
    }

    if (waiver) this._setType(waiver.type)
  }

  _setType = (type) => {
    const isActiveRoster = type === constants.waivers.FREE_AGENCY
    const { league, playerMap, roster, rosterPlayers } = this.props

    const ros = new Roster({ roster: roster.toJS(), league })
    this._isEligible = isActiveRoster
      ? ros.hasOpenBenchSlot(playerMap.get('pos'))
      : ros.hasOpenPracticeSquadSlot()

    const releases = []
    const players = isActiveRoster
      ? rosterPlayers.active
      : rosterPlayers.practice

    for (const releasePlayerMap of players) {
      const r = new Roster({ roster: roster.toJS(), league })
      const slot = releasePlayerMap.get('slot')
      if (slot === constants.slots.PSP || slot === constants.slots.PSDP)
        continue
      r.removePlayer(releasePlayerMap.get('pid'))
      if (isActiveRoster) {
        if (r.hasOpenBenchSlot(releasePlayerMap.get('pos')))
          releases.push(releasePlayerMap)
      } else {
        if (r.hasOpenPracticeSquadSlot()) releases.push(releasePlayerMap)
      }
    }

    this._releases = releases
  }

  handleRelease = (event, value) => {
    const release = value.map((p) => p.id)
    const missingRelease = !this._isEligible && !release.length
    this.setState({ release, missingRelease })
  }

  handleType = (event) => {
    const { value } = event.target
    this.setState({ type: value, release: [], missingType: false })
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
    const { bid, release, error, type } = this.state
    const pid = this.props.playerMap.get('pid')

    if (!type) {
      return this.setState({ missingType: true })
    } else {
      this.setState({ missingType: false })
    }

    if (!this._isEligible && !release.length) {
      return this.setState({ missingRelease: true })
    } else {
      this.setState({ missingRelease: false })
    }

    if (!error) {
      if (this.props.waiver) {
        this.props.update({ waiverId: this.props.waiver.uid, release, bid })
      } else {
        this.props.claim({ bid, release, type, pid })
      }
      this.props.onClose()
    }
  }

  render = () => {
    const { team, playerMap, status, waiver, league } = this.props

    const options = []
    for (const releasePlayerMap of this._releases) {
      const extensions = releasePlayerMap.get('extensions', 0)
      const pos = releasePlayerMap.get('pos')
      const salary = getExtensionAmount({
        pos,
        tag: releasePlayerMap.get('tag'),
        extensions,
        league,
        value: releasePlayerMap.get('value'),
        bid: releasePlayerMap.get('bid')
      })
      options.push({
        id: releasePlayerMap.get('pid'),
        label: releasePlayerMap.get('name'),
        pos,
        team: releasePlayerMap.get('team'),
        pname: releasePlayerMap.get('pname'),
        value: salary
      })
    }

    const releasePlayers = []
    this.state.release.forEach((pid) => {
      const releasePlayerMap = this._releases.find((p) => p.get('pid') === pid)
      releasePlayers.push({
        id: releasePlayerMap.get('pid'),
        label: releasePlayerMap.get('name'),
        pos: releasePlayerMap.get('pos'),
        team: releasePlayerMap.get('team'),
        pname: releasePlayerMap.get('pname'),
        value: releasePlayerMap.get('value')
      })
    })

    const typeItems = []
    if (
      (waiver && waiver.type === constants.waivers.FREE_AGENCY_PRACTICE) ||
      status.waiver.practice
    ) {
      typeItems.push(
        <MenuItem key='practice' value={constants.waivers.FREE_AGENCY_PRACTICE}>
          Practice Squad
        </MenuItem>
      )
    }

    if (
      (waiver && waiver.type === constants.waivers.FREE_AGENCY) ||
      status.waiver.active
    ) {
      typeItems.push(
        <MenuItem key='active' value={constants.waivers.FREE_AGENCY}>
          Active Roster
        </MenuItem>
      )
    }

    const getOptionSelected = (option, value) => option.id === value.id
    const renderOption = (props, option) => {
      return (
        <div {...props}>
          <div className='release__select-player'>
            <div className='release__select-player-value'>${option.value}</div>
            <div className='player__name-position'>
              <Position pos={option.pos} />
            </div>
            <div className='player__name-main'>
              <span>{option.pname}</span>
              <NFLTeam team={option.team} />
            </div>
          </div>
        </div>
      )
    }
    const renderTags = (value, getTagProps) =>
      value.map((option, index) => (
        // eslint-disable-next-line
        <Chip label={option.label} {...getTagProps({ index })} />
      ))
    const title = 'Conditionally release'
    const renderInput = (params) => (
      <TextField
        {...params}
        error={this.state.missingRelease}
        variant='outlined'
        label={title}
        placeholder={title}
      />
    )

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Waiver Claim</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Add ${playerMap.get('name')} (${playerMap.get('pos')})`}
          </DialogContentText>
          <div className='confirmation__inputs'>
            {this.state.type === constants.waivers.FREE_AGENCY && (
              <TextField
                label='Bid'
                helperText={`Max Bid: ${team.faab}`}
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
            )}
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
            {this.state.type && (
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

WaiverConfirmation.propTypes = {
  playerMap: ImmutablePropTypes.map,
  rosterPlayers: PropTypes.object,
  waiver: PropTypes.object,
  roster: ImmutablePropTypes.record,
  team: ImmutablePropTypes.record,
  league: PropTypes.object,
  status: PropTypes.object,
  onClose: PropTypes.func,
  claim: PropTypes.func,
  update: PropTypes.func
}
