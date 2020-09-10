import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getWaiverReportItems, waiverActions, getWaivers } from '@core/waivers'

import WaiversPage from './waivers'

const mapStateToProps = createSelector(
  getWaivers,
  getWaiverReportItems,
  (waivers, items) => ({
    isPending: waivers.get('isPending'),
    items
  })
)

const mapDispatchToProps = {
  load: waiverActions.loadWaivers
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(WaiversPage)
