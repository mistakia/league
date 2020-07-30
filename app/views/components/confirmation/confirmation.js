import React from 'react'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'

import Button from '@components/button'

export default class Confirmation extends React.Component {
  handleClick = () => {
    this.props.info.onConfirm()
    this.props.cancel()
  }

  handleClose = () => {
    this.props.cancel()
  }

  render = () => {
    return (
      <Dialog
        open={!!this.props.info.title}
        onClose={this.handleClose}
        aria-labelledby='alert-dialog-title'
        aria-describedby='alert-dialog-description'
      >
        <DialogTitle id='alert-dialog-title'>{this.props.info.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id='alert-dialog-description'>
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
