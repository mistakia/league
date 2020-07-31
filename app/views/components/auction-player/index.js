import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { isPlayerFreeAgent, isPlayerEligible } from '@core/rosters'
import { auctionActions } from '@core/auction'
import { getPlayers } from '@core/players'

import AuctionPlayer from './auction-player'

const mapStateToProps = createSelector(
  isPlayerFreeAgent,
  isPlayerEligible,
  getApp,
  getPlayers,
  (isFreeAgent, isEligible, app, players) => ({
    isFreeAgent,
    isEligible,
    vbaseline: app.vbaseline,
    watchlist: players.get('watchlist')
  })
)

const mapDispatchToProps = {
  select: auctionActions.select
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AuctionPlayer)
