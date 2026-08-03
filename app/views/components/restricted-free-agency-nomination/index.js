import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  get_current_league,
  get_teams_for_current_league,
  get_restricted_free_agency_players
} from '@core/selectors'

import RestrictedFreeAgencyNomination from './restricted-free-agency-nomination'

const map_state_to_props = createSelector(
  get_current_league,
  get_teams_for_current_league,
  get_app,
  get_restricted_free_agency_players,
  (league, teams, app, restricted_free_agency_players) => ({
    league,
    teams,
    team_id: app.teamId,
    restricted_free_agency_players
  })
)

export default connect(map_state_to_props)(RestrictedFreeAgencyNomination)
