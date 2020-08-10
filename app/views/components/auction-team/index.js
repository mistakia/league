import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction, isTeamConnected, getNominatingTeamId } from '@core/auction'
import { getTeamById } from '@core/teams'
import { getRosterByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'

import AuctionTeam from './auction-team'

const mapStateToProps = createSelector(
  getAuction,
  getTeamById,
  isTeamConnected,
  getNominatingTeamId,
  getRosterByTeamId,
  getCurrentLeague,
  (auction, team, isConnected, nominatingTeamId, rosterRow, league) => ({
    team,
    isConnected,
    isNominating: nominatingTeamId === team.uid,
    isWinningBid: auction.transactions.first()
      ? auction.transactions.first().tid === team.uid
      : false,
    bid: auction.transactions.first()
      ? auction.transactions.first().value
      : null,
    rosterRow,
    league
  })
)

export default connect(
  mapStateToProps
)(AuctionTeam)
