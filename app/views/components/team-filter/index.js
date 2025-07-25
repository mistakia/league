import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_players_state,
  get_teams_for_current_league
} from '@core/selectors'

import TeamFilter from './team-filter'

const map_state_to_props = createSelector(
  get_players_state,
  get_teams_for_current_league,
  (players, teams) => ({ teamIds: players.get('teamIds'), teams })
)

export default connect(map_state_to_props)(TeamFilter)
