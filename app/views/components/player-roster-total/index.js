import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_current_league,
  is_before_restricted_free_agency_end
} from '@core/selectors'
import PlayerRosterTotal from './player-roster-total'

const map_state_to_props = createSelector(
  get_current_league,
  is_before_restricted_free_agency_end,
  (league, is_before_restricted_free_agency_end) => ({
    league,
    is_before_restricted_free_agency_end
  })
)

export default connect(map_state_to_props)(PlayerRosterTotal)
