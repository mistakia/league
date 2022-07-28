import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { auctionActions, getAuction, getAuctionPlayers } from '@core/auction'
import { getCurrentLeague } from '@core/leagues'
import { playerActions } from '@core/players'

import render from './auction'

class AuctionPage extends React.Component {
  componentDidMount() {
    this.props.loadAllPlayers()
    this.props.join()
  }

  render() {
    return render.call(this)
  }
}

AuctionPage.propTypes = {
  join: PropTypes.func,
  toggleHideRostered: PropTypes.func,
  loadAllPlayers: PropTypes.func
}

const mapStateToProps = createSelector(
  getAuctionPlayers,
  getAuction,
  getApp,
  getCurrentLeague,
  (players, auction, app, league) => {
    const sorted = players
      .sort((a, b) => {
        return (
          b.getIn(['vorp', auction.valueType], -9999) -
          a.getIn(['vorp', auction.valueType], -9999)
        )
      })
      .toList()

    return {
      players: sorted,
      searchValue: auction.search,
      nominated_pid: auction.nominated_pid,
      transactions: auction.transactions,
      hideRostered: auction.hideRostered,
      tids: auction.tids,
      isHosted: league.hosted,
      isCommish: app.userId === league.commishid
    }
  }
)

const mapDispatchToProps = {
  join: auctionActions.join,
  search: auctionActions.search,
  toggleHideRostered: auctionActions.toggleHideRostered,
  loadAllPlayers: playerActions.loadAllPlayers
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionPage)
