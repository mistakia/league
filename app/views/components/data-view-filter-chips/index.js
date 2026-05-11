import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_selected_data_view } from '@core/selectors'
import { get_data_views_fields } from '@core/data-views-fields'
import get_active_filter_summaries from '@core/data-views/active-filter-summaries.mjs'

import DataViewFilterChips from './data-view-filter-chips.js'

const get_summaries = createSelector(
  get_selected_data_view,
  get_data_views_fields,
  (selected_data_view, fields) =>
    get_active_filter_summaries({
      where: selected_data_view.table_state.where,
      fields
    })
)

const map_state_to_props = (state) => ({
  summaries: get_summaries(state)
})

export default connect(map_state_to_props)(DataViewFilterChips)
