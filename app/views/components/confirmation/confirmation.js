import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

import ReserveConfirmation from '@components/reserve-confirmation'
import ReserveLongTermConfirmation from '@components/reserve-long-term-confirmation'
import ActivateConfirmation from '@components/activate-confirmation'
import DeactivateConfirmation from '@components/deactivate-confirmation'
import WaiverConfirmation from '@components/waiver-confirmation'
import PoachConfirmation from '@components/poach-confirmation'
import AddPlayerDialog from '@components/add-player-dialog'
import AddFreeAgentDialog from '@components/add-free-agent-dialog'
import FranchiseConfirmation from '@components/franchise-confirmation'
import RookieConfirmation from '@components/rookie-confirmation'
import RestrictedFreeAgencyConfirmation from '@components/restricted-free-agency-confirmation'
import RemoveRestrictedFreeAgencyTagConfirmation from '@components/remove-restricted-free-agency-tag-confirmation'
import RemoveTagConfirmation from '@components/remove-tag-confirmation'

import Button from '@components/button'

import './confirmation.styl'

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
          case 'RESERVE':
            return ReserveConfirmation
          case 'RESERVE_IR_LONG_TERM':
            return ReserveLongTermConfirmation
          case 'ACTIVATE':
            return ActivateConfirmation
          case 'DEACTIVATE':
            return DeactivateConfirmation
          case 'WAIVER':
            return WaiverConfirmation
          case 'POACH':
            return PoachConfirmation
          case 'EDIT_TEAM_ADD_PLAYER':
            return AddPlayerDialog
          case 'ADD_FREE_AGENT':
            return AddFreeAgentDialog
          case 'FRANCHISE':
            return FranchiseConfirmation
          case 'RESTRICTED_FREE_AGENCY':
            return RestrictedFreeAgencyConfirmation
          case 'ROOKIE':
            return RookieConfirmation
          case 'REMOVE_TAG':
            return RemoveTagConfirmation
          case 'REMOVE_RESTRICTED_FREE_AGENCY_TAG':
            return RemoveRestrictedFreeAgencyTagConfirmation
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
      <Dialog open={Boolean(this.props.info.title)} onClose={this.handleClose}>
        <DialogTitle>{this.props.info.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{this.props.info.description}</DialogContentText>
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

Confirmation.propTypes = {
  info: ImmutablePropTypes.record,
  cancel: PropTypes.func
}
