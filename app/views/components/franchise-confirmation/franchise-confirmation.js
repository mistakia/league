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
import { constants } from '@libs-shared'

export default class FranchiseConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      untag: '',
      error: false,
      missingUntag: false
    }

    const { team } = props
    this._isEligible = team.roster.isEligibleForTag({
      tag: constants.tags.FRANCHISE
    })
    this._untags = []
    const tagged_players = team.roster.getPlayersByTag(constants.tags.FRANCHISE)
    const tagged_pids = tagged_players.map((p) => p.pid)
    for (const pid of tagged_pids) {
      const player_map = team.players.find(
        (player_map) => player_map.get('pid') === pid
      )
      this._untags.push(player_map)
    }
  }

  handleUntag = (event) => {
    const { value } = event.target
    this.setState({ untag: value, missingUntag: false })
  }

  handleSubmit = () => {
    const { untag, error } = this.state
    const pid = this.props.player_map.get('pid')

    if (!this._isEligible && !untag) {
      return this.setState({ missingUntag: true })
    } else {
      this.setState({ missingUntag: false })
    }

    if (!error) {
      this.props.add({
        remove: untag,
        tag: constants.tags.FRANCHISE,
        pid
      })
      this.props.onClose()
    }
  }

  render = () => {
    const { player_map } = this.props

    const menuItems = []
    for (const rPlayerMap of this._untags) {
      const pid = rPlayerMap.get('pid')
      menuItems.push(
        <MenuItem key={pid} value={pid}>
          {rPlayerMap.get('name')} ({rPlayerMap.get('pos')})
        </MenuItem>
      )
    }

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Franchise Tag</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Apply Franchise Tag to ${player_map.get('name')} (${player_map.get(
              'pos'
            )})`}
          </DialogContentText>
          <div className='confirmation__inputs'>
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

FranchiseConfirmation.propTypes = {
  team: PropTypes.object,
  onClose: PropTypes.func,
  add: PropTypes.func,
  player_map: ImmutablePropTypes.map
}
