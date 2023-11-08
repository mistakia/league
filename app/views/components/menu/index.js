import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { appActions } from '@core/app'
import { get_app, getCurrentLeague } from '@core/selectors'

import AppMenu from './menu'

const mapStateToProps = createSelector(
  get_app,
  getCurrentLeague,
  (app, league) => ({
    is_logged_in: Boolean(app.userId),
    leagueId: app.leagueId,
    teamId: app.teamId,
    is_commish: league.commishid === app.userId,
    league
  })
)

const mapDispatchToProps = {
  logout: appActions.logout
}

export default connect(mapStateToProps, mapDispatchToProps)(AppMenu)
