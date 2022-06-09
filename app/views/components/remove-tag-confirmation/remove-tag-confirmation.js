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
    const pid = this.props.playerMap.get('player')
    const { tid } = this.props.team.roster
    this.props.remove({ player: pid, teamId: tid }) // TODO pid
    this.props.onClose()
  }

  render() {
    const { playerMap } = this.props
    const tagType = constants.tagsDetail[playerMap.get('tag')]

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>{`Remove ${tagType} Tag`}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Remove ${tagType} Tag from ${playerMap.get(
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

RemoveTagConfirmation.propTypes = {
  playerMap: ImmutablePropTypes.map,
  team: PropTypes.object,
  remove: PropTypes.func,
  onClose: PropTypes.func
}
