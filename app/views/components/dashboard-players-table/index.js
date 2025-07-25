import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { waiver_actions } from '@core/waivers'
import { player_actions } from '@core/players'
import { is_before_extension_deadline } from '@core/selectors'

import DashboardPlayersTable from './dashboard-players-table'

const map_state_to_props = createSelector(
  is_before_extension_deadline,
  (is_before_extension_deadline) => ({ is_before_extension_deadline })
)

const map_dispatch_to_props = {
  reorderWaivers: waiver_actions.reorderWaivers,
  reorder_cutlist: player_actions.reorder_cutlist
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(DashboardPlayersTable)
