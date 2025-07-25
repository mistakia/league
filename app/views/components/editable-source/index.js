import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { source_actions } from '@core/sources'
import { get_source_by_id } from '@core/selectors'

import EditableSource from './editable-source'

const map_state_to_props = createSelector(get_source_by_id, (source) => ({
  source
}))

const map_dispatch_to_props = {
  update: source_actions.update
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(EditableSource)
