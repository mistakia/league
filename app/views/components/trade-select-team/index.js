import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { trade_actions } from '@core/trade'
import {
  get_teams_for_current_league,
  get_app,
  get_current_trade
} from '@core/selectors'

import TradeSelectTeam from './trade-select-team'

const map_state_to_props = createSelector(
  get_teams_for_current_league,
  get_app,
  get_current_trade,
  (teams, app, trade) => ({
    teams: teams
      .filter((t) => t.uid !== app.teamId)
      .toList()
      .toJS(),
    trade
  })
)

const map_dispatch_to_props = {
  select: trade_actions.select_team
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(TradeSelectTeam)
