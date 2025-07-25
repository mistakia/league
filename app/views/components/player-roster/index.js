import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  is_before_extension_deadline,
  is_before_restricted_free_agency_end,
  get_app
} from '@core/selectors'

import PlayerRoster from './player-roster'

const map_state_to_props = createSelector(
  is_before_extension_deadline,
  is_before_restricted_free_agency_end,
  get_app,
  (
    is_before_extension_deadline,
    is_before_restricted_free_agency_end,
    app
  ) => ({
    is_before_extension_deadline,
    is_before_restricted_free_agency_end,
    is_manager_in_league: app.get('leagueIds').includes(app.get('leagueId'))
  })
)

export default connect(map_state_to_props)(PlayerRoster)
