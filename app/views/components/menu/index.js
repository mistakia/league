import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp, appActions } from '@core/app'
import { getCurrentTeam } from '@core/teams'
import { getCurrentLeague } from '@core/leagues'

import Menu from './menu'

const mapStateToProps = createSelector(
  getApp,
  getCurrentTeam,
  getCurrentLeague,
  (app, team, league) => ({
    isLoggedIn: Boolean(app.userId),
    leagueId: app.leagueId,
    league,
    team
  })
)

const mapDispatchToProps = {
  logout: appActions.logout
}

export default connect(mapStateToProps, mapDispatchToProps)(Menu)
