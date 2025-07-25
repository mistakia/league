import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_teams_for_current_league } from '@core/selectors'

import TradeSelectItems from './trade-select-items'

const map_state_to_props = createSelector(
  get_teams_for_current_league,
  (teams) => ({
    teams
  })
)

export default connect(map_state_to_props)(TradeSelectItems)
