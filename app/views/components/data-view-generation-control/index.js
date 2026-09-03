import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { data_view_generation_actions } from '@core/data-view-generation'
import { get_selected_data_view } from '@core/selectors'
import { load_pending_generation } from '#libs-shared/data-view-storage/storage.mjs'

import DataViewGenerationControl from './data-view-generation-control.js'

// Read ONCE, at module scope, and passed as a prop rather than read in the
// component. The value is only meaningful at mount -- it answers "was a run in
// flight when this page last unloaded" -- and reading localStorage during a
// render would make it a moving value that re-fires the resume effect.
const pending_generation = load_pending_generation()

const map_state_to_props = createSelector(
  (state) => state.get('data_view_generation'),
  get_selected_data_view,
  (state) => state.getIn(['app', 'userId']),
  (generation, selected_data_view, user_id) => ({
    generation: generation ? generation.toJS() : {},
    table_state: selected_data_view?.table_state ?? null,
    is_logged_in: Boolean(user_id),
    pending_generation_id: pending_generation?.generation_id ?? null
  })
)

const map_dispatch_to_props = {
  submit_data_view_generation:
    data_view_generation_actions.submit_data_view_generation,
  dismiss_data_view_generation:
    data_view_generation_actions.dismiss_data_view_generation,
  resume_data_view_generation:
    data_view_generation_actions.resume_data_view_generation
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(DataViewGenerationControl)
