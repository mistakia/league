import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
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
import { constants } from '@common'

export default class RookieConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      untag: '',
      error: false,
      missingUntag: false
    }

    const { team } = props
    this._isEligible = team.roster.isEligibleForTag({
      tag: constants.tags.ROOKIE
    })
    this._untags = []
    const tagged_players = team.roster.getPlayersByTag(constants.tags.ROOKIE)
    tagged_players.forEach(({ pid }) => {
      const taggedPlayerMap = team.players.find(
        (playerMap) => playerMap.get('pid') === pid
      )
      this._untags.push(taggedPlayerMap)
    })
  }

  handleUntag = (event) => {
    const { value } = event.target
    this.setState({ untag: value, missingUntag: false })
  }

  handleSubmit = () => {
    const { untag, error } = this.state
    const pid = this.props.playerMap.get('pid')

    if (!this._isEligible && !untag) {
      return this.setState({ missingUntag: true })
    } else {
      this.setState({ missingUntag: false })
    }

    if (!error) {
      this.props.add({ remove: untag, tag: constants.tags.ROOKIE, pid })
      this.props.onClose()
    }
  }

  render = () => {
    const { playerMap } = this.props

    const menuItems = []
    for (const taggedPlayerMap of this._untags) {
      const pid = taggedPlayerMap.get('pid')
      menuItems.push(
        <MenuItem key={pid} value={pid}>
          {taggedPlayerMap.get('name')} ({taggedPlayerMap.get('pos')})
        </MenuItem>
      )
    }

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Rookie Tag</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Apply Rookie Tag to ${playerMap.get('name')} (${playerMap.get(
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

RookieConfirmation.propTypes = {
  team: PropTypes.object,
  add: PropTypes.func,
  playerMap: ImmutablePropTypes.map,
  onClose: PropTypes.func
}
