import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { rosterActions } from '@core/rosters'
import { auctionActions, getAuction, getAuctionPlayers } from '@core/auction'
import { getCurrentLeague } from '@core/leagues'

import render from './auction'

class AuctionPage extends React.Component {
  componentDidMount () {
    this.props.join()
    this.props.load()
  }

  render () {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getAuctionPlayers,
  getAuction,
  getApp,
  getCurrentLeague,
  (players, auction, app, league) => ({
    players,
    valueType: auction.valueType,
    searchValue: auction.search,
    playerId: auction.player,
    transactions: auction.transactions,
    tids: auction.tids,
    vbaseline: app.vbaseline,
    isHosted: league.hosted,
    isCommish: app.userId === league.commishid
  })
)

const mapDispatchToProps = {
  load: rosterActions.loadRosters,
  join: auctionActions.join,
  search: auctionActions.search
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionPage)
