import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { app_actions } from '@core/app'
import { get_app, get_current_league } from '@core/selectors'

import AppMenu from './menu'

const map_state_to_props = createSelector(
  get_app,
  get_current_league,
  (app, league) => ({
    is_logged_in: Boolean(app.userId),
    leagueId: app.leagueId,
    teamId: app.teamId,
    is_commish: league.commishid === app.userId,
    league
  })
)

const map_dispatch_to_props = {
  logout: app_actions.logout
}

export default connect(map_state_to_props, map_dispatch_to_props)(AppMenu)
