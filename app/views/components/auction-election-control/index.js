import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_auction_state,
  get_app,
  getCurrentTeamRoster,
  is_free_agent_period
} from '@core/selectors'
import { auction_actions } from '@core/auction'
import { player_actions } from '@core/players'

import AuctionElectionControl from './auction-election-control'

// Connects on `pid` as ownProps. `standing_elections` holds only the viewing
// team's rows, so reading one entry is a Map lookup that returns a stable
// reference -- no memoization needed, and connect's shallow compare then
// re-renders exactly the control whose election changed.
const map_state_to_props = createSelector(
  get_auction_state,
  get_app,
  getCurrentTeamRoster,
  is_free_agent_period,
  (state) => state.getIn(['app', 'leagueId']),
  (state, props) => props.pid,
  (auction, app, roster, is_in_free_agent_period, leagueId, pid) => ({
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
    // THE window test, not a proxy for one, and it is this component's own
    // because its two call sites do not agree on anything stronger. The drawer
    // in selected-player gates on `can_elect_on_player`, which already carries
    // `is_free_agent_period`; the compact control in auction-main-bid gates
    // only on election mode plus a nomination. This used to ask whether a
    // period was CONFIGURED, which is true forever once a start date is set, so
    // the bid-bar path would have rendered a control outside the window and the
    // server -- which does check, per test/auction.election-window.spec.mjs --
    // would have refused the submission.
    is_election_window_open: is_in_free_agent_period
  })
)

// Each name here is resolved against its actions module rather than trusted:
// bindActionCreators copies only values that are functions, so a name that does
// not exist is dropped from the props object with no connect-time warning, no
// lint error and no build failure -- the symptom is a TypeError the first time
// someone clicks. `select_player` is app/core/players/actions.js:59.
const map_dispatch_to_props = {
  submit_auction_election: auction_actions.submit_auction_election,
  withdraw_auction_election: auction_actions.withdraw_auction_election,
  select_player: player_actions.select_player
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AuctionElectionControl)
