import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction, isTeamConnected, getTeamBid } from '@core/auction'
import { getTeamById } from '@core/teams'
import { getRosterByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'

import AuctionTeam from './auction-team'

const mapStateToProps = createSelector(
  getAuction,
  getTeamById,
  isTeamConnected,
  getRosterByTeamId,
  getCurrentLeague,
  getTeamBid,
  (auction, team, isConnected, rosterRow, league, bid) => ({
    team,
    isConnected,
    isNominating: auction.nominatingTeamId === team.uid,
    isWinningBid: auction.transactions.first()
      ? auction.transactions.first().tid === team.uid
      : false,
    bid,
    rosterRow,
    league
  })
)

export default connect(
  mapStateToProps
)(AuctionTeam)
