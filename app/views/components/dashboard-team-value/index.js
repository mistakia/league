import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentTeamRosterPositionalValue } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'

import DashboardTeamValue from './dashboard-team-value'

const mapStateToProps = createSelector(
  getCurrentTeamRosterPositionalValue,
  getCurrentLeague,
  (summary, league) => ({ summary, league })
)

export default connect(mapStateToProps)(DashboardTeamValue)
