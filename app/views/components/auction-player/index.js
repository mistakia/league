import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { isPlayerFreeAgent, isPlayerEligible } from '@core/rosters'
import { auctionActions, getAuction } from '@core/auction'
import { getPlayers } from '@core/players'

import AuctionPlayer from './auction-player'

const mapStateToProps = createSelector(
  isPlayerFreeAgent,
  isPlayerEligible,
  getPlayers,
  getAuction,
  (isFreeAgent, isEligible, players, auction) => ({
    isFreeAgent,
    isEligible,
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
