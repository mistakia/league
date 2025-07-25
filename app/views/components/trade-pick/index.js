import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_teams_for_current_league,
  get_draft_pick_value_by_pick
} from '@core/selectors'

import TradePick from './trade-pick'

const map_state_to_props = createSelector(
  get_teams_for_current_league,
  get_draft_pick_value_by_pick,
  (teams, draft_value) => ({ teams, draft_value })
)

export default connect(map_state_to_props)(TradePick)
