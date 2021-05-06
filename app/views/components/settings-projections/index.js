import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSources } from '@core/sources'

import SettingsProjections from './settings-projections'

const mapStateToProps = createSelector(getSources, (sources) => ({
  sourceIds: sources.toList().map((s) => s.uid)
}))

export default connect(mapStateToProps)(SettingsProjections)
