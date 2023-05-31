import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { tradeActions } from '@core/trade'
import {
  getTeamsForCurrentLeague,
  get_app,
  getCurrentTrade
} from '@core/selectors'

import TradeSelectTeam from './trade-select-team'

const mapStateToProps = createSelector(
  getTeamsForCurrentLeague,
  get_app,
  getCurrentTrade,
  (teams, app, trade) => ({
    teams: teams
      .filter((t) => t.uid !== app.teamId)
      .toList()
      .toJS(),
    trade
  })
)

const mapDispatchToProps = {
  select: tradeActions.selectTeam
}

export default connect(mapStateToProps, mapDispatchToProps)(TradeSelectTeam)
