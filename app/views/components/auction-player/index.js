import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { isPlayerFreeAgent, isPlayerEligible } from '@core/rosters'
import { auctionActions, getAuction } from '@core/auction'
import { getPlayers } from '@core/players'

import AuctionPlayer from './auction-player'

const mapStateToProps = createSelector(
  isPlayerFreeAgent,
  isPlayerEligible,
  getApp,
  getPlayers,
  getAuction,
  (isFreeAgent, isEligible, app, players, auction) => ({
    isFreeAgent,
    isEligible,
    vbaseline: app.vbaseline,
    watchlist: players.get('watchlist'),
    valueType: auction.valueType,
    selected: auction.selected,
    nominatedPlayer: auction.player
  })
)

const mapDispatchToProps = {
  select: auctionActions.select
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionPlayer)
