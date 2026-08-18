import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Alert from '@mui/material/Alert'

import Button from '@components/button'
import TradeVetoCountdown from '@components/trade-veto-countdown'
import { is_trade_within_veto_window } from '#libs-shared'

export default class TradeAction extends React.Component {
  handleProposeClick = () => this.props.propose()
  handleAcceptClick = () => this.props.accept()
  handleRejectClick = () => this.props.reject()
  handleCancelClick = () => this.props.cancel()
  handle_veto_click = () => this.props.veto()
  handle_approve_click = () => this.props.approve()

  // Both endpoints can refuse a legitimate request -- a traded player has
  // locked into a scored lineup, the receiving team has signed someone into the
  // space the trade opened, or the other action won a race -- so the reason is
  // rendered beside the buttons.
  render_commish_actions = () => {
    const { league, trade, is_commish, action_error } = this.props

    if (!is_commish || !is_trade_within_veto_window({ trade, league })) {
      return null
    }

    return (
      <div className='trade__veto'>
        <Button onClick={this.handle_veto_click}>Veto Trade</Button>
        <Button onClick={this.handle_approve_click}>Approve Trade</Button>
        <TradeVetoCountdown trade={trade} league={league} />
        {action_error && <Alert severity='error'>{action_error}</Alert>}
      </div>
    )
  }

  render = () => {
    const { league, trade, isValid, isProposer } = this.props
    if (!league.is_hosted) {
      return null
    } else if (trade.cancelled) {
      return <Button disabled>Cancelled</Button>
    } else if (trade.rejected) {
      return <Button disabled>Rejected</Button>
    } else if (trade.accepted) {
      // An approved trade is settled, so it reads Approved rather than
      // Accepted -- and the commissioner block below renders nothing for it,
      // since the window it acts within is closed.
      return (
        <div>
          <Button disabled>{trade.approved ? 'Approved' : 'Accepted'}</Button>
          {this.render_commish_actions()}
        </div>
      )
    } else if (trade.vetoed) {
      return <Button disabled>Vetoed</Button>
    } else if (!isValid) {
      return <Button disabled>Exceeds Limits</Button>
    } else if (!trade.trade_id) {
      if (
        (trade.proposingTeamPlayers.size || trade.proposingTeamPicks.size) &&
        (trade.acceptingTeamPlayers.size || trade.acceptingTeamPicks.size)
      ) {
        return <Button onClick={this.handleProposeClick}>Propose</Button>
      } else {
        return <Button disabled>Propose</Button>
      }
    } else {
      if (isProposer) {
        return <Button onClick={this.handleCancelClick}>Cancel Offer</Button>
      } else {
        return (
          <div>
            <Button onClick={this.handleAcceptClick}>Accept Offer</Button>
            <Button onClick={this.handleRejectClick}>Reject Offer</Button>
          </div>
        )
      }
    }
  }
}

TradeAction.propTypes = {
  propose: PropTypes.func,
  accept: PropTypes.func,
  reject: PropTypes.func,
  cancel: PropTypes.func,
  veto: PropTypes.func,
  approve: PropTypes.func,
  isValid: PropTypes.bool,
  isProposer: PropTypes.bool,
  is_commish: PropTypes.bool,
  action_error: PropTypes.string,
  league: PropTypes.object,
  trade: ImmutablePropTypes.record
}
