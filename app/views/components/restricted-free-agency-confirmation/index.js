import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import {
  get_current_players_for_league,
  get_cutlist_total_salary,
  get_players_state
} from '@core/selectors'

import RestrictedFreeAgencyConfirmation from './restricted-free-agency-confirmation'

const map_state_to_props = createSelector(
  get_current_players_for_league,
  get_cutlist_total_salary,
  get_players_state,
  (team, cutlist_total_salary, players) => ({
    team,
    cutlist_total_salary,
    cutlist: players.get('cutlist')
  })
)

const map_dispatch_to_props = {
  add_restricted_free_agency_tag: roster_actions.add_restricted_free_agency_tag,
  update_restricted_free_agency_tag:
    roster_actions.update_restricted_free_agency_tag
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(RestrictedFreeAgencyConfirmation)
