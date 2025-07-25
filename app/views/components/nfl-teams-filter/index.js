import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'

import NFLTeamsFilter from './nfl-teams-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  nflTeams: players.get('nflTeams')
}))

export default connect(map_state_to_props)(NFLTeamsFilter)
