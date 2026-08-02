import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_restricted_free_agency_state } from '@core/selectors'
import { restricted_free_agency_actions } from '@core/restricted-free-agency'

import RestrictedFreeAgencyPage from './restricted-free-agency'

const map_state_to_props = createSelector(
  get_restricted_free_agency_state,
  (restricted_free_agency) => ({
    auctions: restricted_free_agency.get('auctions'),
    year: restricted_free_agency.get('year'),
    is_pending: restricted_free_agency.get('is_pending')
  })
)

// Both names are verified against the actions module rather than trusted: a
// creator that does not exist is dropped silently by bindActionCreators, with
// no connect warning, no lint error and no build failure -- the symptom arrives
// only when a user fires the handler.
const map_dispatch_to_props = {
  load_restricted_free_agency_auctions:
    restricted_free_agency_actions.load_restricted_free_agency_auctions,
  select_restricted_free_agency_year:
    restricted_free_agency_actions.select_restricted_free_agency_year
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(RestrictedFreeAgencyPage)
