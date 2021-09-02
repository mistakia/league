import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction } from '@core/auction'
import { getPlayerById } from '@core/players'

import AuctionNominatedPlayer from './auction-nominated-player'

const mapStateToProps = createSelector(
  getPlayerById,
  getAuction,
  (player, auction) => ({
    player,
    valueType: auction.valueType
  })
)

export default connect(mapStateToProps)(AuctionNominatedPlayer)
