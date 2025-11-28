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
import { isReserveEligible } from '@libs-shared'
import { current_season, roster_slot_types } from '@constants'

export default class ActivateConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      reserve_pid: '',
      release_pid: '',
      deactivate_pid: '',
      missing: false
    }

    const { team, player_map, psquad_eligible_active_players } = props
    this._hasBenchSpace = team.roster.has_bench_space()
    this._reserveEligible = []
    this._activePlayers = []

    // Check if player being activated is from practice squad (signed slots)
    const player_slot = player_map.get('slot')
    this._isFromPracticeSquad =
      player_slot === roster_slot_types.PS ||
      player_slot === roster_slot_types.PSP

    // Use psquad-eligible active players for deactivation candidates (filtered in index.js)
    this._deactivationCandidates = this._isFromPracticeSquad
      ? psquad_eligible_active_players.toArray()
      : []

    const active_pids = team.roster.active.map((p) => p.pid)
    for (const pid of active_pids) {
      const activePlayerMap = team.players.find(
        (player_map) => player_map.get('pid') === pid
      )
      this._activePlayers.push(activePlayerMap)

      const practice_week = activePlayerMap.get('practice_week')
      const practice_data = practice_week ? practice_week.toJS() : null

      if (
        isReserveEligible({
          nfl_status: activePlayerMap.get('nfl_status'),
          injury_status: activePlayerMap.get('injury_status'),
          prior_week_inactive: activePlayerMap.get('prior_week_inactive'),
          prior_week_ruled_out: activePlayerMap.get('prior_week_ruled_out'),
          week: current_season.week,
          is_regular_season: current_season.isRegularSeason,
          game_day: activePlayerMap.get('game_day'),
          practice: practice_data
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

  handleSelectDeactivate = (event) => {
    const { value } = event.target
    this.setState({ deactivate_pid: value, missing: false })
  }

  handleSubmit = () => {
    const { reserve_pid, release_pid, deactivate_pid } = this.state
    const activate_pid = this.props.player_map.get('pid')

    if (
      !this._hasBenchSpace &&
      !reserve_pid &&
      !release_pid &&
      !deactivate_pid
    ) {
      return this.setState({ missing: true })
    } else {
      this.setState({ missing: false })
    }

    this.props.activate({
      activate_pid,
      reserve_pid,
      release_pid,
      deactivate_pid,
      slot: roster_slot_types.RESERVE_SHORT_TERM
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

    const deactivateItems = []
    for (const activePlayerMap of this._deactivationCandidates) {
      const pid = activePlayerMap.get('pid')
      deactivateItems.push(
        <MenuItem key={pid} value={pid}>
          {activePlayerMap.get('name')} ({activePlayerMap.get('pos')})
        </MenuItem>
      )
    }

    const isReservePlayer =
      player_map.get('slot') === roster_slot_types.RESERVE_SHORT_TERM
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
          {this._isFromPracticeSquad && Boolean(deactivateItems.length) && (
            <div className='confirmation__inputs'>
              <FormControl size='small' variant='outlined'>
                <InputLabel id='deactivate-label'>Deactivate</InputLabel>
                <Select
                  labelId='deactivate-label'
                  value={this.state.deactivate_pid}
                  onChange={this.handleSelectDeactivate}
                  label='Deactivate'
                >
                  <MenuItem value=''>None</MenuItem>
                  {deactivateItems}
                </Select>
              </FormControl>
            </div>
          )}
          <div className='confirmation__inputs'>
            {isReservePlayer &&
              !this._hasBenchSpace &&
              !this.state.deactivate_pid &&
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
            {!this._hasBenchSpace && !this.state.deactivate_pid && (
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
  team: PropTypes.object,
  psquad_eligible_active_players: ImmutablePropTypes.list
}
