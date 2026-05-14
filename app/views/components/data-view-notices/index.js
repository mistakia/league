import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_selected_data_view } from '@core/selectors'
import get_data_view_notices from '@core/data-views/data-view-notices.mjs'

import DataViewNotices from './data-view-notices.js'

const get_notices = createSelector(
  get_selected_data_view,
  (selected_data_view) =>
    get_data_view_notices({
      where: selected_data_view.table_state.where,
      columns: selected_data_view.table_state.columns
    })
)

const map_state_to_props = (state) => ({
  notices: get_notices(state)
})

export default connect(map_state_to_props)(DataViewNotices)
