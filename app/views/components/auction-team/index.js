import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  getAuction,
  isTeamConnected,
  getTeamBid,
  getTeamById,
  getRosterByTeamId
} from '@core/selectors'

import AuctionTeam from './auction-team'

const mapStateToProps = createSelector(
  getAuction,
  getTeamById,
  isTeamConnected,
  getRosterByTeamId,
  getTeamBid,
  get_app,
  (auction, team, isConnected, roster, bid, app) => ({
    team,
    isConnected,
    isOwner: team.uid === app.teamId,
    isNominating: auction.nominatingTeamId === team.uid,
    isWinningBid: auction.transactions.first()
      ? auction.transactions.first().tid === team.uid
      : false,
    bid,
    roster
  })
)

export default connect(mapStateToProps)(AuctionTeam)
