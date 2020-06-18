import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { auctionActions, getAuction, getNominatingTeamId } from '@core/auction'
import { getApp } from '@core/app'

import AuctionMainBid from './auction-main-bid'

const mapStateToProps = createSelector(
  getAuction,
  getNominatingTeamId,
  getApp,
  (auction, nominatingTeamId, app) => ({
    isPaused: auction.isPaused,
    player: auction.player,
    selected: auction.selected,
    bidValue: auction.bid,
    isNominating: nominatingTeamId === app.teamId,
    nominatingTeamId: nominatingTeamId
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
