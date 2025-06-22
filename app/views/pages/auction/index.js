import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getAuction } from '@core/selectors'
import { player_actions } from '@core/players'
import { leagueActions } from '@core/leagues'
import { roster_actions } from '@core/rosters'

import AuctionPage from './auction'

const mapStateToProps = createSelector(getAuction, (auction) => ({
  transactions: auction.transactions,
  tids: auction.tids
}))

const mapDispatchToProps = {
  load_all_players: player_actions.load_all_players,
  load_league: leagueActions.load_league,
  load_rosters: roster_actions.load_rosters
}

export default connect(mapStateToProps, mapDispatchToProps)(AuctionPage)
