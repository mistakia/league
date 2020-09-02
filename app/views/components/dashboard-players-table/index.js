import { connect } from 'react-redux'

import { waiverActions } from '@core/waivers'

import DashboardPlayersTable from './dashboard-players-table'

const mapDispatchToProps = {
  reorderWaivers: waiverActions.reorderWaivers
}

export default connect(
  null,
  mapDispatchToProps
)(DashboardPlayersTable)
