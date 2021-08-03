import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import FormControl from '@material-ui/core/FormControl'
import MenuItem from '@material-ui/core/MenuItem'
import InputLabel from '@material-ui/core/InputLabel'
import Select from '@material-ui/core/Select'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'

import Button from '@components/button'
import { constants } from '@common'

export default class RookieConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      untag: '',
      error: false,
      missingUntag: false
    }

    const { team, player } = props
    this._isEligible = team.roster.isEligibleForTag({
      tag: constants.tags.ROOKIE,
      player: player.player
    })
    this._untags = []
    const taggedPlayers = team.roster.getPlayersByTag(constants.tags.ROOKIE)
    const taggedPlayerIds = taggedPlayers.map((p) => p.player)
    for (const playerId of taggedPlayerIds) {
      const player = team.players.find((p) => p.player === playerId)
      this._untags.push(player)
    }
  }

  handleUntag = (event) => {
    const { value } = event.target
    this.setState({ untag: value, missingUntag: false })
  }

  handleSubmit = () => {
    const { untag, error } = this.state
    const player = this.props.player.player

    if (!this._isEligible && !untag) {
      return this.setState({ missingUntag: true })
    } else {
      this.setState({ missingUntag: false })
    }

    if (!error) {
      this.props.tag({ remove: untag, tag: constants.tags.ROOKIE, player })
      this.props.onClose()
    }
  }

  render = () => {
    const { player } = this.props

    const menuItems = []
    for (const rPlayer of this._untags) {
      menuItems.push(
        <MenuItem key={rPlayer.player} value={rPlayer.player}>
          {rPlayer.name} ({rPlayer.pos})
        </MenuItem>
      )
    }

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Rookie Tag</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Apply Rookie Tag to ${player.name} (${player.pos})`}
          </DialogContentText>
          <div className='waiver__claim-inputs'>
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

RookieConfirmation.propTypes = {
  team: PropTypes.object,
  tag: PropTypes.func,
  player: ImmutablePropTypes.record,
  status: PropTypes.object,
  onClose: PropTypes.func,
  waiver: PropTypes.object
}
