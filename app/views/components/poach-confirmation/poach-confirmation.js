import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'

import Button from '@components/button'
import { Roster, constants } from '@common'

export default class PoachConfirmation extends React.Component {
  constructor(props) {
    super(props)

    const releases = []
    const { league, player } = props
    for (const rPlayer of props.rosterPlayers.active) {
      const r = new Roster({ roster: props.roster.toJS(), league })
      r.removePlayer(rPlayer.player)
      if (r.hasOpenBenchSlot(player.pos)) {
        releases.push(rPlayer)
      }
    }

    this._releases = releases
    this.state = { release: [], error: false }
  }

  handleRelease = (event) => {
    const { value } = event.target
    this.setState({ release: value })
  }

  handleSubmit = () => {
    const { isPlayerEligible } = this.props
    const player = this.props.player.player
    const { release } = this.state

    if (!isPlayerEligible && !release.length) {
      return this.setState({ error: true })
    } else {
      this.setState({ error: false })
    }

    if (this.props.status.waiver.poach) {
      this.props.claim({ release, player, type: constants.waivers.POACH })
    } else {
      this.props.poach({ release, player })
    }
    this.props.onClose()
  }

  render = () => {
    const { isPlayerEligible, rosterInfo, status, player } = this.props

    const menuItems = []
    for (const rPlayer of this._releases) {
      menuItems.push(
        <MenuItem key={rPlayer.player} value={rPlayer.player}>
          {rPlayer.name} ({rPlayer.pos})
        </MenuItem>
      )
    }

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
          {!isPlayerEligible && (
            <DialogContentText>
              There is not enough roster or salary space on your active roster.
              Please select a player to release. They will only be released if
              your claim is successful.
            </DialogContentText>
          )}
          <FormControl size='small' variant='outlined'>
            <InputLabel id='release-label'>Release</InputLabel>
            <Select
              labelId='release-label'
              value={this.state.release}
              error={this.state.error}
              onChange={this.handleRelease}
              label='Release'>
              {menuItems}
            </Select>
          </FormControl>
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
  claim: PropTypes.func,
  poach: PropTypes.func,
  isPlayerEligible: PropTypes.bool,
  player: ImmutablePropTypes.record,
  rosterPlayers: PropTypes.object,
  roster: ImmutablePropTypes.record,
  onClose: PropTypes.func,
  rosterInfo: PropTypes.object
}
