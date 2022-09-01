import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp, appActions } from '@core/app'
import { getCurrentTeam } from '@core/teams'
import { getCurrentLeague } from '@core/leagues'

import AppMenu from './menu'

const mapStateToProps = createSelector(
  getApp,
  getCurrentTeam,
  getCurrentLeague,
  (app, team, league) => ({
    isLoggedIn: Boolean(app.userId),
    leagueId: app.leagueId,
    teamId: app.teamId,
    isCommish: league.commishid === app.userId,
    league,
    team
  })
)

const mapDispatchToProps = {
  logout: appActions.logout
}

export default connect(mapStateToProps, mapDispatchToProps)(AppMenu)
