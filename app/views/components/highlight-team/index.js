import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_players_state,
  get_teams_for_current_league
} from '@core/selectors'

import HighlightTeam from './highlight-team'

const map_state_to_props = createSelector(
  get_players_state,
  get_teams_for_current_league,
  (players, teams) => ({
    highlight_teamIds: players.get('highlight_teamIds'),
    teams
  })
)

export default connect(map_state_to_props)(HighlightTeam)
