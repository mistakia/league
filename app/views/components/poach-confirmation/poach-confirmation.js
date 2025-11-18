import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import Button from '@components/button'
import { Roster, constants, getExtensionAmount } from '@libs-shared'

export default class PoachConfirmation extends React.Component {
  constructor(props) {
    super(props)

    const releases = []
    const { league, player_map, poach } = props
    const pos = player_map.get('pos')
    for (const activePlayerMap of props.team.active) {
      const r = new Roster({ roster: props.roster.toJS(), league })
      r.removePlayer(activePlayerMap.get('pid'))
      if (r.has_bench_space_for_position(pos)) {
        releases.push(activePlayerMap)
      }
    }

    const release = poach ? poach.release : []
    const isValid = this.isPoachValid(release)

    this._releases = releases
    this.state = {
      release,
      error: !isValid
    }
  }

  isPoachValid = (release) => {
    const { roster, league, player_map } = this.props
    const r = new Roster({ roster: roster.toJS(), league })
    for (const pid of release) {
      r.removePlayer(pid)
    }

    // TODO - valid salary during offseason

    return r.has_bench_space_for_position(player_map.get('pos'))
  }

  handleRelease = (event, value) => {
    const pids = value.map((p) => p.id)
    const isValid = this.isPoachValid(pids)
    this.setState({ release: pids, error: !isValid })
  }

  handleSubmit = () => {
    if (this.state.error) {
      return
    }

    const { poach, player_map } = this.props
    const { release } = this.state

    if (this.props.status.waiver.poach) {
      this.props.submitWaiverClaim({
        release,
        pid: player_map.get('pid'),
        type: constants.waivers.POACH
      })
    } else if (poach.uid) {
      this.props.updatePoach({ poachId: poach.uid, release })
    } else {
      this.props.submitPoach({ release, pid: player_map.get('pid') })
    }
    this.props.onClose()
  }

  render = () => {
    const { rosterInfo, status, player_map, team, league } = this.props

    const options = []
    team.active.forEach((activePlayerMap) => {
      const pos = activePlayerMap.get('pos')
      const extensions = player_map.get('extensions', 0)
      const salary = getExtensionAmount({
        pos,
        tag: activePlayerMap.get('tag'),
        extensions,
        league,
        value: activePlayerMap.get('value'),
        bid: activePlayerMap.get('bid')
      })
      options.push({
        id: activePlayerMap.get('pid'),
        label: activePlayerMap.get('name'),
        pos,
        team: activePlayerMap.get('team'),
        pname: activePlayerMap.get('pname'),
        value: salary
      })
    })
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
    const title = 'Select players to conditionally release'
    const renderInput = (params) => (
      <TextField
        {...params}
        error={this.state.error}
        variant='outlined'
        label={title}
        placeholder={title}
      />
    )
    const releasePlayers = []
    const releasePlayerMaps = this.props.team.players.concat(
      this.props.releasePlayers
    )
    this.state.release.forEach((pid) => {
      const releasePlayerMap = releasePlayerMaps.find(
        (pMap) => pMap.get('pid') === pid
      )
      releasePlayers.push({
        id: releasePlayerMap.get('pid'),
        label: releasePlayerMap.get('name'),
        pos: releasePlayerMap.get('pos'),
        team: releasePlayerMap.get('team'),
        pname: releasePlayerMap.get('pname'),
        value: releasePlayerMap.get('value')
      })
    })

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>
          {status.waiver.poach ? 'Poaching Waiver Claim' : 'Poaching Claim'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Poach ${player_map.get('name')} (${player_map.get(
              'pos'
            )}). If your claim is successful, he will be added to your active roster with a salary of $${
              rosterInfo.value + 2
            } and will not be eligible for the practice squad. The player's current manager can choose to process the claim at any time.`}
          </DialogContentText>
          <DialogContentText>
            {status.waiver.poach
              ? "This is a waiver claim and can be cancelled anytime before it's processed."
              : 'This is a poaching claim and can not be cancelled once submitted.'}
          </DialogContentText>
          {this.state.error && (
            <DialogContentText>
              There is not enough roster or salary space on your active roster.
              Please select a player to release. They will only be released if
              your claim is successful.
            </DialogContentText>
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

PoachConfirmation.propTypes = {
  league: PropTypes.object,
  status: PropTypes.object,
  submitWaiverClaim: PropTypes.func,
  submitPoach: PropTypes.func,
  updatePoach: PropTypes.func,
  player_map: ImmutablePropTypes.map,
  team: PropTypes.object,
  roster: ImmutablePropTypes.record,
  onClose: PropTypes.func,
  rosterInfo: PropTypes.object,
  poach: ImmutablePropTypes.record,
  releasePlayers: ImmutablePropTypes.list
}
