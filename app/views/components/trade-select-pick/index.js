import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_draft_pick_by_id,
  get_teams_for_current_league
} from '@core/selectors'

import TradeSelectPick from './trade-select-pick'

const map_state_to_props = createSelector(
  get_draft_pick_by_id,
  get_teams_for_current_league,
  (pick, teams) => ({ pick, teams })
)

export default connect(map_state_to_props)(TradeSelectPick)
