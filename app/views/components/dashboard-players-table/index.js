import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { waiverActions } from '@core/waivers'
import { playerActions } from '@core/players'
import { isBeforeExtensionDeadline } from '@core/selectors'

import DashboardPlayersTable from './dashboard-players-table'

const mapStateToProps = createSelector(
  isBeforeExtensionDeadline,
  (isBeforeExtensionDeadline) => ({ isBeforeExtensionDeadline })
)

const mapDispatchToProps = {
  reorderWaivers: waiverActions.reorderWaivers,
  reorderCutlist: playerActions.reorderCutlist
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DashboardPlayersTable)
