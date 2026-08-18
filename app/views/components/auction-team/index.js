import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  get_auction_state,
  isTeamConnected,
  get_team_free_agency_auction_bid,
  get_team_by_id_for_current_year,
  getRosterByTeamId
} from '@core/selectors'

import AuctionTeam from './auction-team'

const map_state_to_props = createSelector(
  get_auction_state,
  get_team_by_id_for_current_year,
  isTeamConnected,
  getRosterByTeamId,
  get_team_free_agency_auction_bid,
  get_app,
  (auction, team, isConnected, roster, bid, app) => ({
    team,
    isConnected,
    isOwner: team.team_id === app.teamId,
    isNominating: auction.nominating_team_id === team.team_id,
    isWinningBid: auction.transactions.first()
      ? auction.transactions.first().tid === team.team_id
      : false,
    bid,
    roster
  })
)

export default connect(map_state_to_props)(AuctionTeam)
