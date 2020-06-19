import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { auctionActions, getAuction, getNominatingTeamId } from '@core/auction'
import { getApp } from '@core/app'
import { isPlayerEligible } from '@core/rosters'
import { getCurrentTeam } from '@core/teams'

import AuctionMainBid from './auction-main-bid'

const mapStateToProps = createSelector(
  getAuction,
  getNominatingTeamId,
  getApp,
  getCurrentTeam,
  isPlayerEligible,
  (auction, nominatingTeamId, app, team, isEligible) => ({
    isPaused: auction.isPaused,
    isLocked: auction.isLocked,
    isWinningBid: auction.transactions.first()
      ? auction.transactions.first().tid === app.teamId
      : false,
    selected: auction.selected,
    bidValue: auction.bid,
    isNominating: nominatingTeamId === app.teamId,
    nominatingTeamId: nominatingTeamId,
    timer: auction.timer,
    availableCap: team.acap,
    isAboveCap: auction.bid >= team.acap,
    isEligible
  })
)

const mapDispatchToProps = {
  nominate: auctionActions.nominate,
  bid: auctionActions.bid
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionMainBid)
