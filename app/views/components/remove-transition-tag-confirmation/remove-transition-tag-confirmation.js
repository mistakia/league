import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'

import Button from '@components/button'

export default class RemoveTransitionTagConfirmation extends React.Component {
  handleSubmit = () => {
    const { player } = this.props.player
    const { tid } = this.props.team.roster
    this.props.remove({ player, teamId: tid })
    this.props.onClose()
  }

  render() {
    const { player } = this.props

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Remove Transition Bid</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Remove Transition Bid on ${player.name} (${player.pos})`}
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

RemoveTransitionTagConfirmation.propTypes = {
  player: ImmutablePropTypes.record,
  team: PropTypes.object,
  remove: PropTypes.func,
  onClose: PropTypes.func
}
