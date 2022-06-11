import React from 'react'
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

import Button from '@components/button'
import { constants } from '@common'

export default class FranchiseConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      untag: '',
      error: false,
      missingUntag: false
    }

    const { team, playerMap } = props
    this._isEligible = team.roster.isEligibleForTag({
      tag: constants.tags.FRANCHISE,
      pid: playerMap.get('pid')
    })
    this._untags = []
    const tagged_players = team.roster.getPlayersByTag(constants.tags.FRANCHISE)
    const tagged_pids = tagged_players.map((p) => p.pid)
    for (const pid of tagged_pids) {
      const playerMap = team.players.find(
        (playerMap) => playerMap.get('pid') === pid
      )
      this._untags.push(playerMap)
    }
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
      this.props.add({
        remove: untag,
        tag: constants.tags.FRANCHISE,
        player: pid
      })
      this.props.onClose()
    }
  }

  render = () => {
    const { playerMap } = this.props

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
            {`Apply Franchise Tag to ${playerMap.get('name')} (${playerMap.get(
              'pos'
            )})`}
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
  league: PropTypes.object,
  add: PropTypes.func,
  status: PropTypes.object,
  playerMap: ImmutablePropTypes.map,
  waiver: PropTypes.object
}
