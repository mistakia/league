import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_source_by_id } from '@core/selectors'

import Source from './source'

const map_state_to_props = createSelector(get_source_by_id, (source) => ({
  source
}))

export default connect(map_state_to_props)(Source)
