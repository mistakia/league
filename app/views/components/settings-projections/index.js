import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_sources_state } from '@core/sources'

import SettingsProjections from './settings-projections'

const map_state_to_props = createSelector(get_sources_state, (sources) => ({
  sourceIds: sources.toList().map((s) => s.uid)
}))

export default connect(map_state_to_props)(SettingsProjections)
