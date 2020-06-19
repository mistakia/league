import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction } from '@core/auction'
import { getTeamById } from '@core/teams'

import AuctionTeam from './auction-team'

const mapStateToProps = createSelector(
  getAuction,
  getTeamById,
  (auction, team) => ({ transactions: auction.transactions, team })
)

export default connect(
  mapStateToProps
)(AuctionTeam)
