import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { auctionActions, getAuction, getNominatingTeamId } from '@core/auction'
import { getApp } from '@core/app'
import { isPlayerEligible } from '@core/rosters'
import { getCurrentTeam } from '@core/teams'
import { getCurrentLeague } from '@core/leagues'

import AuctionMainBid from './auction-main-bid'

const mapStateToProps = createSelector(
  getAuction,
  getNominatingTeamId,
  getApp,
  getCurrentTeam,
  isPlayerEligible,
  getCurrentLeague,
  (auction, nominatingTeamId, app, team, isEligible, league) => ({
    isPaused: auction.isPaused,
    isCommish: app.userId === league.commishid,
    isLocked: auction.isLocked,
    isWinningBid: auction.transactions.first()
      ? auction.transactions.first().tid === app.teamId
      : false,
    selected: auction.selected,
    bidValue: auction.bid,
    isNominating: nominatingTeamId === app.teamId,
    nominatingTeamId: nominatingTeamId,
    timer: auction.timer,
    availableCap: team.cap,
    isAboveCap: auction.bid >= team.cap,
    isEligible,
    auctionStart: league.adate
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
