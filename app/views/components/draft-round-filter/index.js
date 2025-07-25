import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'

import DraftRoundFilter from './draft-round-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  nfl_draft_rounds: players.get('nfl_draft_rounds')
}))

export default connect(map_state_to_props)(DraftRoundFilter)
