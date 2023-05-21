import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_source_by_id } from '@core/selectors'

import Source from './source'

const mapStateToProps = createSelector(get_source_by_id, (source) => ({
  source
}))

export default connect(mapStateToProps)(Source)
