import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getWaivers } from '@core/selectors'

import WaiverTypeFilter from './waiver-type-filter'

const mapStateToProps = createSelector(getWaivers, (waivers) => ({
  type: waivers.get('type')
}))

export default connect(mapStateToProps)(WaiverTypeFilter)
