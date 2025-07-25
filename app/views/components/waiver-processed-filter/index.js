import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_waivers } from '@core/selectors'

import WaiverProcessedFilter from './waiver-processed-filter'

const map_state_to_props = createSelector(get_waivers, (waivers) => ({
  processed: waivers.get('processed'),
  processing_times: waivers.get('processingTimes')
}))

export default connect(map_state_to_props)(WaiverProcessedFilter)
