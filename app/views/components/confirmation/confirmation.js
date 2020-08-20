import React from 'react'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import WaiverConfirmation from '@components/waiver-confirmation'
import PoachConfirmation from '@components/poach-confirmation'
import AddPlayerDialog from '@components/add-player-dialog'

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
          case 'waiver': return WaiverConfirmation
          case 'poach': return PoachConfirmation
          case 'add': return AddPlayerDialog
        }
      }
      const ConfirmationComponent = getComponent(this.props.info.id)
      const { data } = this.props.info
      return (
        <ConfirmationComponent
          onClose={this.handleClose}
          onSubmit={this.handleClick}
          data={data}
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
