import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getWaiverReportItems, getWaivers } from '@core/selectors'
import { waiverActions } from '@core/waivers'

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

export default connect(mapStateToProps, mapDispatchToProps)(WaiversPage)
