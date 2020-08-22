import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { auctionActions, getAuction } from '@core/auction'
import { getApp } from '@core/app'
import { isPlayerEligible, getCurrentTeamRoster } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { notificationActions } from '@core/notifications'

import AuctionMainBid from './auction-main-bid'

const mapStateToProps = createSelector(
  getAuction,
  getApp,
  getCurrentTeamRoster,
  isPlayerEligible,
  getCurrentLeague,
  (auction, app, roster, isEligible, league) => ({
    isPaused: auction.isPaused,
    isComplete: auction.isComplete,
    isCommish: app.userId === league.commishid,
    isLocked: auction.isLocked,
    isWinningBid: auction.transactions.first()
      ? auction.transactions.first().tid === app.teamId
      : false,
    selected: auction.selected,
    bidValue: auction.bid,
    isNominating: auction.nominatingTeamId === app.teamId,
    nominatingTeamId: auction.nominatingTeamId,
    timer: auction.timer,
    availableCap: roster.availableCap,
    isAboveCap: auction.bid >= roster.availableCap,
    isEligible,
    auctionStart: league.adate
  })
)

const mapDispatchToProps = {
  nominate: auctionActions.nominate,
  bid: auctionActions.bid,
  showNotification: notificationActions.show
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionMainBid)
