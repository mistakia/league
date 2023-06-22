import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { appActions } from '@core/app'
import { get_app, getCurrentLeague } from '@core/selectors'

import AppMenu from './menu'

const mapStateToProps = createSelector(
  get_app,
  getCurrentLeague,
  (app, league) => ({
    isLoggedIn: Boolean(app.userId),
    leagueId: app.leagueId,
    teamId: app.teamId,
    isCommish: league.commishid === app.userId,
    league
  })
)

const mapDispatchToProps = {
  logout: appActions.logout
}

export default connect(mapStateToProps, mapDispatchToProps)(AppMenu)
