import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions } from '@core/rosters'
import { auctionActions, getAuction, getAuctionPlayers } from '@core/auction'

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
  (players, auction) => ({
    players,
    searchValue: auction.search,
    playerId: auction.player,
    transactions: auction.transactions,
    tids: auction.tids
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
