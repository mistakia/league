import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_waiver_report_items, get_waivers } from '@core/selectors'
import { waiver_actions } from '@core/waivers'

import WaiversPage from './waivers'

const map_state_to_props = createSelector(
  get_waivers,
  get_waiver_report_items,
  (waivers, items) => ({
    isPending: waivers.get('isPending'),
    items
  })
)

const map_dispatch_to_props = {
  load: waiver_actions.loadWaivers
}

export default connect(map_state_to_props, map_dispatch_to_props)(WaiversPage)
