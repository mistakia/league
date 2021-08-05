import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { waiverActions } from '@core/waivers'
import { isBeforeExtensionDeadline } from '@core/leagues'

import DashboardPlayersTable from './dashboard-players-table'

const mapStateToProps = createSelector(
  isBeforeExtensionDeadline,
  (isBeforeExtensionDeadline) => ({ isBeforeExtensionDeadline })
)

const mapDispatchToProps = {
  reorderWaivers: waiverActions.reorderWaivers
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DashboardPlayersTable)
