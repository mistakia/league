import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { app_actions } from '@core/app'
import { contribution_actions } from '@core/contributions'
import { get_app, get_current_league } from '@core/selectors'

import AppMenu from './menu'

const map_state_to_props = createSelector(
  get_app,
  get_current_league,
  (app, league) => ({
    is_logged_in: Boolean(app.userId),
    leagueId: app.leagueId,
    teamId: app.teamId,
    is_commish: league.commissioner_user_id === app.userId,
    league
  })
)

const map_dispatch_to_props = {
  logout: app_actions.logout,
  open_contribution_dialog: contribution_actions.open_contribution_dialog
}

export default connect(map_state_to_props, map_dispatch_to_props)(AppMenu)
