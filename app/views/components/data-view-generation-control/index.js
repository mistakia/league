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
  // The per-account entitlement, read off the user record GET /api/me
  // populates. It subsumes the old is_logged_in prop: an anonymous visitor has
  // no user record, so the flag is undefined and the control does not render.
  (state) => state.getIn(['app', 'user', 'data_view_generation_is_enabled']),
  (generation, selected_data_view, is_generation_enabled) => ({
    generation: generation ? generation.toJS() : {},
    table_state: selected_data_view?.table_state ?? null,
    is_generation_enabled: Boolean(is_generation_enabled),
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
