import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/leagues'
import { tradeActions, getCurrentTrade } from '@core/trade'
import { getApp } from '@core/app'

import TradeSelectTeam from './trade-select-team'

const mapStateToProps = createSelector(
  getTeamsForCurrentLeague,
  getApp,
  getCurrentTrade,
  (teams, app, trade) => ({
    teams,
    teamId: app.teamId,
    trade
  })
)

const mapDispatchToProps = {
  select: tradeActions.selectTeam
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TradeSelectTeam)
