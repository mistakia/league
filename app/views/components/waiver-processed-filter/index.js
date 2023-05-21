import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getWaivers } from '@core/selectors'

import WaiverProcessedFilter from './waiver-processed-filter'

const mapStateToProps = createSelector(getWaivers, (waivers) => ({
  processed: waivers.get('processed'),
  processingTimes: waivers.get('processingTimes')
}))

export default connect(mapStateToProps)(WaiverProcessedFilter)
