import React from 'react'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import WaiverConfirmation from '@components/waiver-confirmation'
import PoachConfirmation from '@components/poach-confirmation'
import AddPlayerDialog from '@components/add-player-dialog'
import AddFreeAgentDialog from '@components/add-free-agent-dialog'

import Button from '@components/button'

export default class Confirmation extends React.Component {
  handleClick = (args) => {
    this.props.info.onConfirm(args)
    this.props.cancel()
  }

  handleClose = () => {
    this.props.cancel()
  }

  render = () => {
    if (this.props.info.id) {
      const getComponent = (id) => {
        switch (id) {
          case 'WAIVER': return WaiverConfirmation
          case 'POACH': return PoachConfirmation
          case 'EDIT_TEAM_ADD_PLAYER': return AddPlayerDialog
          case 'ADD_FREE_AGENT': return AddFreeAgentDialog
        }
      }
      const ConfirmationComponent = getComponent(this.props.info.id)
      const { data } = this.props.info
      return (
        <ConfirmationComponent
          onClose={this.handleClose}
          onSubmit={this.handleClick}
          {...data}
        />
      )
    }

    return (
      <Dialog open={!!this.props.info.title} onClose={this.handleClose}>
        <DialogTitle>{this.props.info.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {this.props.info.description}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleClose} text>
            Cancel
          </Button>
          <Button onClick={this.handleClick} text>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}
