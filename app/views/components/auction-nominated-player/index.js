import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'

import AuctionNominatedPlayer from './auction-nominated-player'

const mapStateToProps = createSelector(getPlayerById, (player) => ({
  player
}))

export default connect(mapStateToProps)(AuctionNominatedPlayer)
