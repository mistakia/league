import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'

import Button from '@components/button'
import { constants, isReserveEligible } from '@libs-shared'

export default class ActivateConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      reserve_pid: '',
      release_pid: '',
      missing: false
    }

    const { team, player_map } = props
    this._hasBenchSpace = team.roster.hasOpenBenchSlot(player_map.get('pos'))
    this._reserveEligible = []
    this._activePlayers = []

    const active_pids = team.roster.active.map((p) => p.pid)
    for (const pid of active_pids) {
      const activePlayerMap = team.players.find(
        (player_map) => player_map.get('pid') === pid
      )
      this._activePlayers.push(activePlayerMap)
      if (
        isReserveEligible({
          nfl_status: activePlayerMap.get('nfl_status'),
          injury_status: activePlayerMap.get('injury_status'),
          prior_week_inactive: activePlayerMap.get('prior_week_inactive'),
          week: constants.season.week,
          is_regular_season: constants.season.isRegularSeason,
          game_day: activePlayerMap.get('game_day')
        })
      ) {
        this._reserveEligible.push(activePlayerMap)
      }
    }
  }

  handleSelectReserve = (event) => {
    const { value } = event.target
    this.setState({ reserve_pid: value, missing: false })
  }

  handleSelectRelease = (event) => {
    const { value } = event.target
    this.setState({ release_pid: value, missing: false })
  }

  handleSubmit = () => {
    const { reserve_pid, release_pid } = this.state
    const activate_pid = this.props.player_map.get('pid')

    if (!this._hasBenchSpace && !reserve_pid && !release_pid) {
      return this.setState({ missing: true })
    } else {
      this.setState({ missing: false })
    }

    this.props.activate({
      activate_pid,
      reserve_pid,
      release_pid,
      slot: constants.slots.RESERVE_SHORT_TERM
    })
    this.props.onClose()
  }

  render = () => {
    const { player_map } = this.props

    const reserveItems = []
    for (const reservePlayerMap of this._reserveEligible) {
      const pid = reservePlayerMap.get('pid')
      reserveItems.push(
        <MenuItem key={pid} value={pid}>
          {reservePlayerMap.get('name')} ({reservePlayerMap.get('pos')})
        </MenuItem>
      )
    }

    const releaseItems = []
    for (const activePlayerMap of this._activePlayers) {
      const pid = activePlayerMap.get('pid')
      releaseItems.push(
        <MenuItem key={pid} value={pid}>
          {activePlayerMap.get('name')} ({activePlayerMap.get('pos')})
        </MenuItem>
      )
    }

    const isReservePlayer =
      player_map.get('slot') === constants.slots.RESERVE_SHORT_TERM
    let noBenchSpaceMessage =
      'No active roster space available, make room by releasing a player'
    if (isReservePlayer)
      noBenchSpaceMessage +=
        ' or moving any reserve eligible players to reserve.'

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Activate Player</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`${player_map.get('fname')} ${player_map.get(
              'lname'
            )} (${player_map.get(
              'pos'
            )}) will be placed on the active roster. If the player was not previously activated, activating them will make them ineligible for the practice squad.`}
          </DialogContentText>
          {!this._hasBenchSpace && (
            <DialogContentText>{noBenchSpaceMessage}</DialogContentText>
          )}
          <div className='confirmation__inputs'>
            {isReservePlayer &&
              !this._hasBenchSpace &&
              Boolean(reserveItems.length) && (
                <FormControl size='small' variant='outlined'>
                  <InputLabel id='reserve-label'>Reserve</InputLabel>
                  <Select
                    labelId='reserve-label'
                    error={this.state.missing}
                    value={this.state.reserve_pid}
                    onChange={this.handleSelectReserve}
                    label='Reserve'
                  >
                    {reserveItems}
                  </Select>
                </FormControl>
              )}
          </div>
          <div className='confirmation__inputs'>
            {!this._hasBenchSpace && (
              <FormControl size='small' variant='outlined'>
                <InputLabel id='release-label'>Release</InputLabel>
                <Select
                  labelId='release-label'
                  error={this.state.missing}
                  value={this.state.release_pid}
                  onChange={this.handleSelectRelease}
                  label='Release'
                >
                  {releaseItems}
                </Select>
              </FormControl>
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

ActivateConfirmation.propTypes = {
  onClose: PropTypes.func,
  activate: PropTypes.func,
  player_map: ImmutablePropTypes.map,
  team: PropTypes.object
}
