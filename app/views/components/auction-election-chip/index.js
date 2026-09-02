import { connect } from 'react-redux'

import { get_auction_state } from '@core/selectors'
import { player_actions } from '@core/players'

import AuctionElectionChip from './auction-election-chip'

// A PLAIN map_state_to_props, not a module-level createSelector, and that is
// load-bearing rather than a style choice: reselect's default cache size is one,
// so a single memoized selector shared across hundreds of mounted rows would
// recompute on every instance and memoize nothing. Reading one Map entry needs
// no memoization and returns a stable reference, so connect's shallow compare
// re-renders exactly the row whose election changed.
//
// For the same reason `standing_elections` must NOT be added to auction-targets'
// mapped props -- that would re-render all six board columns on every election.
const map_state_to_props = (state, { pid }) => ({
  election: get_auction_state(state).standing_elections.get(pid)
})

const map_dispatch_to_props = {
  select_player: player_actions.select_player
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AuctionElectionChip)
