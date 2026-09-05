import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { data_views_actions } from '@core/data-views'
import { get_selected_data_view } from '@core/selectors'

import DataViewHistoryControl from './data-view-history-control.js'

const map_state_to_props = createSelector(
  get_selected_data_view,
  (selected_data_view) => ({
    view_id: selected_data_view?.view_id ?? null,
    table_state: selected_data_view?.table_state ?? null
  })
)

const map_dispatch_to_props = {
  step_data_view_history_back: data_views_actions.step_data_view_history_back,
  step_data_view_history_forward:
    data_views_actions.step_data_view_history_forward
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(DataViewHistoryControl)
