import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'

import Button from '@components/button'
import { constants } from '@libs-shared'

export default class RemoveTagConfirmation extends React.Component {
  handleSubmit = () => {
    const pid = this.props.playerMap.get('pid')
    const { tid } = this.props.team.roster
    this.props.remove({ pid, teamId: tid })
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
