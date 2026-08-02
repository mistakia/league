import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Alert from '@mui/material/Alert'

import Button from '@components/button'
import TradeVetoCountdown from '@components/trade-veto-countdown'
import { is_trade_within_veto_window } from '@libs-shared'

export default class TradeAction extends React.Component {
  handleProposeClick = () => this.props.propose()
  handleAcceptClick = () => this.props.accept()
  handleRejectClick = () => this.props.reject()
  handleCancelClick = () => this.props.cancel()
  handle_veto_click = () => this.props.veto()

  // The endpoint can refuse a legitimate veto -- a traded player has locked
  // into a scored lineup, or the receiving team has signed someone into the
  // space the trade opened -- so its reason is rendered next to the button.
  render_veto = () => {
    const { league, trade, is_commish, veto_error } = this.props

    if (!is_commish || !is_trade_within_veto_window({ trade, league })) {
      return null
    }

    return (
      <div className='trade__veto'>
        <Button onClick={this.handle_veto_click}>Veto Trade</Button>
        <TradeVetoCountdown trade={trade} league={league} />
        {veto_error && <Alert severity='error'>{veto_error}</Alert>}
      </div>
    )
  }

  render = () => {
    const { league, trade, isValid, isProposer } = this.props
    if (!league.hosted) {
      return null
    } else if (trade.cancelled) {
      return <Button disabled>Cancelled</Button>
    } else if (trade.rejected) {
      return <Button disabled>Rejected</Button>
    } else if (trade.accepted) {
      return (
        <div>
          <Button disabled>Accepted</Button>
          {this.render_veto()}
        </div>
      )
    } else if (trade.vetoed) {
      return <Button disabled>Vetoed</Button>
    } else if (!isValid) {
      return <Button disabled>Exceeds Limits</Button>
    } else if (!trade.uid) {
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
  isValid: PropTypes.bool,
  isProposer: PropTypes.bool,
  is_commish: PropTypes.bool,
  veto_error: PropTypes.string,
  league: PropTypes.object,
  trade: ImmutablePropTypes.record
}
