import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_auction_state,
  get_app,
  get_current_league,
  getCurrentTeamRoster
} from '@core/selectors'
import { auction_actions } from '@core/auction'

import AuctionElectionControl from './auction-election-control'

// Connects on `pid` as ownProps. `standing_elections` holds only the viewing
// team's rows, so reading one entry is a Map lookup that returns a stable
// reference -- no memoization needed, and connect's shallow compare then
// re-renders exactly the control whose election changed.
const map_state_to_props = createSelector(
  get_auction_state,
  get_app,
  get_current_league,
  getCurrentTeamRoster,
  (state) => state.getIn(['app', 'leagueId']),
  (state, props) => props.pid,
  (auction, app, league, roster, leagueId, pid) => ({
    election: auction.standing_elections.get(pid),
    // The capping term, named on the control rather than only in the
    // standing-elections panel: a manager deciding a ceiling here has no other
    // reason to have the panel open, and min(stated, availableCap) is what
    // actually gets bid.
    available_cap: roster.availableCap,
    // `app.leagueId` rather than a field on the league record: `uid` is the
    // retired identifier and test/app.retired-uid-identifier.spec.mjs fails any
    // read of it in app/.
    leagueId,
    teamId: app.teamId,
    // Elections open at the free agency period start, days before any live
    // block. The auction page's own mount gate is what decides whether this is
    // reachable; this only guards against rendering a control for a league with
    // no free agency period configured at all.
    is_election_window_open: Boolean(league.free_agency_period_start)
  })
)

const map_dispatch_to_props = {
  submit_auction_election: auction_actions.submit_auction_election,
  withdraw_auction_election: auction_actions.withdraw_auction_election
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AuctionElectionControl)
