import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import {
  get_current_players_for_league,
  get_current_team_roster_record,
  get_current_league
} from '@core/selectors'

import AddFreeAgentDialog from './add-free-agent-dialog'

const map_state_to_props = createSelector(
  get_current_players_for_league,
  get_current_team_roster_record,
  get_current_league,
  (rosterPlayers, roster, league) => ({
    rosterPlayers,
    roster,
    league
  })
)

const map_dispatch_to_props = {
  add_free_agent: roster_actions.add_free_agent
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AddFreeAgentDialog)
