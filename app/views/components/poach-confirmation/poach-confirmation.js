import React from 'react'
import { List } from 'immutable'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'
import Autocomplete from '@material-ui/lab/Autocomplete'
import TextField from '@material-ui/core/TextField'
import Chip from '@material-ui/core/Chip'

import Position from '@components/position'
import Team from '@components/team'
import Button from '@components/button'
import { Roster, constants, getExtensionAmount } from '@common'

export default class PoachConfirmation extends React.Component {
  constructor(props) {
    super(props)

    const releases = []
    const { league, player, poach } = props
    for (const rPlayer of props.team.active) {
      const r = new Roster({ roster: props.roster.toJS(), league })
      r.removePlayer(rPlayer.player)
      if (r.hasOpenBenchSlot(player.pos)) {
        releases.push(rPlayer)
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
    const { roster, league, player } = this.props
    const r = new Roster({ roster: roster.toJS(), league })
    for (const player of release) {
      r.removePlayer(player)
    }

    // TODO - valid salary during offseason

    return r.hasOpenBenchSlot(player.pos)
  }

  handleRelease = (event, value) => {
    const playerIds = value.map((p) => p.id)
    const isValid = this.isPoachValid(playerIds)
    this.setState({ release: playerIds, error: !isValid })
  }

  handleSubmit = () => {
    if (this.state.error) {
      return
    }

    const { poach, player } = this.props
    const { release } = this.state

    if (this.props.status.waiver.poach) {
      this.props.submitWaiverClaim({
        release,
        player: player.player,
        type: constants.waivers.POACH
      })
    } else if (poach.uid) {
      this.props.updatePoach({ poachId: poach.uid, release })
    } else {
      this.props.submitPoach({ release, player: player.player })
    }
    this.props.onClose()
  }

  render = () => {
    const { rosterInfo, status, player, team, league } = this.props

    const options = []
    team.active.forEach((player) => {
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
        error={this.state.error}
        variant='outlined'
        label={title}
        placeholder={title}
      />
    )
    const releasePlayers = []
    const releasePlayerPool = this.props.team.players.concat(
      this.props.releasePlayers
    )
    this.state.release.forEach((playerId) => {
      const player = releasePlayerPool.find((p) => p.player === playerId)
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
        <DialogTitle>
          {status.waiver.poach ? 'Poaching Waiver Claim' : 'Poaching Claim'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Poach ${player.name} (${
              player.pos
            }). If your claim is successful, he will be added to your active roster with a salary of $${
              rosterInfo.value + 2
            } and will not be eligible for the practice squad.`}
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
  player: ImmutablePropTypes.record,
  team: PropTypes.object,
  roster: ImmutablePropTypes.record,
  onClose: PropTypes.func,
  rosterInfo: PropTypes.object,
  poach: ImmutablePropTypes.record,
  releasePlayers: ImmutablePropTypes.list
}
