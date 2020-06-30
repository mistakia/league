import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/leagues'
import { tradeActions } from '@core/trade'
import { getCurrentTeam } from '@core/teams'

import TradeSelectTeam from './trade-select-team'

const mapStateToProps = createSelector(
  getTeamsForCurrentLeague,
  getCurrentTeam,
  (teams, team) => ({ teams, team })
)

const mapDispatchToProps = {
  select: tradeActions.selectTeam
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TradeSelectTeam)
