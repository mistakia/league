import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Button from '@components/button'

export default class TradeAction extends React.Component {
  handleProposeClick = () => this.props.propose()
  handleAcceptClick = () => this.props.accept()
  handleRejectClick = () => this.props.reject()
  handleCancelClick = () => this.props.cancel()

  render = () => {
    const { league, trade, isValid, isProposer } = this.props
    if (!league.hosted) {
      return null
    } else if (trade.cancelled) {
      return <Button disabled>Cancelled</Button>
    } else if (trade.rejected) {
      return <Button disabled>Rejected</Button>
    } else if (trade.accepted) {
      return <Button disabled>Accepted</Button>
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
  isValid: PropTypes.bool,
  isProposer: PropTypes.bool,
  league: PropTypes.object,
  trade: ImmutablePropTypes.record
}
