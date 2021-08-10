import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogTitle from '@material-ui/core/DialogTitle'

import Button from '@components/button'
import { constants } from '@common'

export default class RemoveTagConfirmation extends React.Component {
  handleSubmit = () => {
    const { player } = this.props.player
    const { tid } = this.props.team.roster
    this.props.remove({ player, teamId: tid })
    this.props.onClose()
  }

  render() {
    const { player } = this.props
    const tagType = constants.tagsDetail[player.tag]

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>{`Remove ${tagType} Tag`}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Remove ${tagType} Tag from ${player.name} (${player.pos})`}
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

RemoveTagConfirmation.propTypes = {
  player: ImmutablePropTypes.record,
  team: PropTypes.object,
  remove: PropTypes.func,
  onClose: PropTypes.func
}
