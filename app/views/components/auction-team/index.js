import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction, isTeamConnected, getNominatingTeamId } from '@core/auction'
import { getTeamById } from '@core/teams'

import AuctionTeam from './auction-team'

const mapStateToProps = createSelector(
  getAuction,
  getTeamById,
  isTeamConnected,
  getNominatingTeamId,
  (auction, team, isConnected, nominatingTeamId) => ({
    team,
    isConnected,
    isNominating: nominatingTeamId === team.uid,
    isWinningBid: auction.transactions.first()
      ? auction.transactions.first().tid === team.uid
      : false,
    bid: auction.transactions.first()
      ? auction.transactions.first().value
      : null
  })
)

export default connect(
  mapStateToProps
)(AuctionTeam)
