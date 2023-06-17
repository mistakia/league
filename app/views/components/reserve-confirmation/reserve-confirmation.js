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

export default class ReserveConfirmation extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      activate_pid: '',
      missingActivate: false
    }

    const { team } = props
    this._hasReserveSpace = team.roster.hasOpenInjuredReserveSlot()
    this._activatable = []

    const reserve_pids = team.roster.reserve.map((p) => p.pid)
    for (const pid of reserve_pids) {
      const playerMap = team.players.find((p) => p.get('pid') === pid)
      this._activatable.push(playerMap)
    }
  }

  handleSelectActivate = (event) => {
    const { value } = event.target
    this.setState({ activate_pid: value, missingActivate: false })
  }

  handleSubmit = () => {
    const { activate_pid } = this.state
    const reserve_pid = this.props.playerMap.get('pid')

    if (!this._hasReserveSpace && !activate_pid) {
      return this.setState({ missingActivate: true })
    } else {
      this.setState({ missingActivate: false })
    }

    this.props.reserve({ reserve_pid, slot: constants.slots.IR, activate_pid })
    this.props.onClose()
  }

  render = () => {
    const { playerMap } = this.props

    const menuItems = []
    for (const aPlayerMap of this._activatable) {
      const pid = aPlayerMap.get('pid')
      menuItems.push(
        <MenuItem key={pid} value={pid}>
          {aPlayerMap.get('name')} ({aPlayerMap.get('pos')})
        </MenuItem>
      )
    }

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Designate Reserve</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`${playerMap.get('fname')} ${playerMap.get(
              'lname'
            )} (${playerMap.get(
              'pos'
            )}) will be placed on Reserves/IR. He will not be available to use in lineups until he's activated.`}
          </DialogContentText>
          {!this._hasReserveSpace && (
            <DialogContentText>
              No reserve space available, make room by activating a player from
              reserve.
            </DialogContentText>
          )}
          <div className='confirmation__inputs'>
            {!this._hasReserveSpace && (
              <FormControl size='small' variant='outlined'>
                <InputLabel id='activate-label'>Activate</InputLabel>
                <Select
                  labelId='activate-label'
                  error={this.state.missingActivate}
                  value={this.state.activate_pid}
                  onChange={this.handleSelectActivate}
                  label='Activate'
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

ReserveConfirmation.propTypes = {
  onClose: PropTypes.func,
  reserve: PropTypes.func,
  playerMap: ImmutablePropTypes.map,
  team: PropTypes.object
}
