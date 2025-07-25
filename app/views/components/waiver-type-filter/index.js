import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_waivers } from '@core/selectors'

import WaiverTypeFilter from './waiver-type-filter'

const map_state_to_props = createSelector(get_waivers, (waivers) => ({
  type: waivers.get('type')
}))

export default connect(map_state_to_props)(WaiverTypeFilter)
