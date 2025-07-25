import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { app_actions } from '@core/app'
import { get_app, get_current_league } from '@core/selectors'

import SelectYear from './select-year'

const map_state_to_props = createSelector(
  get_app,
  get_current_league,
  (app, league) => ({
    year: app.year,
    league
  })
)

const map_dispatch_to_props = {
  select_year: app_actions.select_year
}

export default connect(map_state_to_props, map_dispatch_to_props)(SelectYear)
