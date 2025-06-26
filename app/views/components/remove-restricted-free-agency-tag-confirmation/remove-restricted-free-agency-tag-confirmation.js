import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'

import Button from '@components/button'

export default class RemoveRestrictedFreeAgencyTagConfirmation extends React.Component {
  handleSubmit = () => {
    const pid = this.props.playerMap.get('pid')
    const { tid } = this.props.team.roster
    this.props.remove({ pid, teamId: tid })
    this.props.onClose()
  }

  render() {
    const { playerMap } = this.props

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Remove Restricted Free Agency Bid</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Remove Restricted Free Agency Bid on ${playerMap.get(
              'name'
            )} (${playerMap.get('pos')})`}
          </DialogContentText>
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

RemoveRestrictedFreeAgencyTagConfirmation.propTypes = {
  playerMap: ImmutablePropTypes.map,
  team: PropTypes.object,
  remove: PropTypes.func,
  onClose: PropTypes.func
}
