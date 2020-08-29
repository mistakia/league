import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction, isTeamConnected, getTeamBid } from '@core/auction'
import { getTeamById } from '@core/teams'
import { getRosterByTeamId } from '@core/rosters'

import AuctionTeam from './auction-team'

const mapStateToProps = createSelector(
  getAuction,
  getTeamById,
  isTeamConnected,
  getRosterByTeamId,
  getTeamBid,
  (auction, team, isConnected, roster, bid) => ({
    team,
    isConnected,
    isNominating: auction.nominatingTeamId === team.uid,
    isWinningBid: auction.transactions.first()
      ? auction.transactions.first().tid === team.uid
      : false,
    bid,
    roster
  })
)

export default connect(
  mapStateToProps
)(AuctionTeam)
