import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSourceById } from '@core/sources'

import Source from './source'

const mapStateToProps = createSelector(getSourceById, (source) => ({ source }))

export default connect(mapStateToProps)(Source)
