import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, get_current_league, get_players_state } from '@core/selectors'

import Roster from './roster'

const map_state_to_props = createSelector(
  get_current_league,
  get_app,
  get_players_state,
  (league, app, players) => ({
    league,
    team_id: app.teamId,
    players
  })
)

export default connect(map_state_to_props)(Roster)
