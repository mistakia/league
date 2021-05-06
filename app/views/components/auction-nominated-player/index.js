import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction } from '@core/auction'
import { getPlayerById } from '@core/players'
import { getApp } from '@core/app'

import AuctionNominatedPlayer from './auction-nominated-player'

const mapStateToProps = createSelector(
  getPlayerById,
  getAuction,
  getApp,
  (player, auction, app) => ({
    player,
    valueType: auction.valueType,
    vbaseline: app.vbaseline
  })
)

export default connect(mapStateToProps)(AuctionNominatedPlayer)
