import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_waiver_by_id,
  get_current_players_for_league,
  get_current_team_roster_record,
  get_current_league,
  get_current_team,
  getPlayerStatus
} from '@core/selectors'
import { waiver_actions } from '@core/waivers'

import WaiverConfirmation from './waiver-confirmation'

const map_state_to_props = createSelector(
  get_current_players_for_league,
  get_current_team_roster_record,
  get_current_league,
  getPlayerStatus,
  get_current_team,
  get_waiver_by_id,
  (rosterPlayers, roster, league, status, team, waiver) => ({
    rosterPlayers,
    roster,
    league,
    status,
    team,
    waiver
  })
)

const map_dispatch_to_props = {
  claim: waiver_actions.claim,
  update: waiver_actions.update
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(WaiverConfirmation)
