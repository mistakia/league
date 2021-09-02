import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { auctionActions, getAuction, getAuctionPlayers } from '@core/auction'
import { getCurrentLeague } from '@core/leagues'

import render from './auction'

class AuctionPage extends React.Component {
  componentDidMount() {
    this.props.join()
  }

  render() {
    return render.call(this)
  }
}

AuctionPage.propTypes = {
  join: PropTypes.func,
  toggleHideRostered: PropTypes.func
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
    hideRostered: auction.hideRostered,
    tids: auction.tids,
    vbaseline: app.vbaseline,
    isHosted: league.hosted,
    isCommish: app.userId === league.commishid
  })
)

const mapDispatchToProps = {
  join: auctionActions.join,
  search: auctionActions.search,
  toggleHideRostered: auctionActions.toggleHideRostered
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionPage)
