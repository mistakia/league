import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { app_actions } from '@core/app'
import { contribution_actions } from '@core/contributions'
import {
  get_app,
  get_current_league,
  get_leagues_for_user
} from '@core/selectors'

import AppMenu from './menu'

const map_state_to_props = createSelector(
  get_app,
  get_current_league,
  get_leagues_for_user,
  (app, league, user_leagues) => ({
    is_logged_in: Boolean(app.userId),
    leagueId: app.leagueId,
    teamId: app.teamId,
    is_commish: league.commissioner_user_id === app.userId,
    // Gated on the SESSION as well as the count. `leagueIds` seeds with the
    // default league id for everyone, so a logged-out visitor browsing into a
    // second league would otherwise be offered a switch between two leagues
    // they are a manager in neither of.
    user_leagues: app.userId ? user_leagues : [],
    league
  })
)

const map_dispatch_to_props = {
  logout: app_actions.logout,
  open_contribution_dialog: contribution_actions.open_contribution_dialog
}

export default connect(map_state_to_props, map_dispatch_to_props)(AppMenu)
