import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp, appActions } from '@core/app'
import { getCurrentTeam } from '@core/teams'

import Menu from './menu'

const mapStateToProps = createSelector(getApp, getCurrentTeam, (app, team) => ({
  isLoggedIn: Boolean(app.userId),
  team
}))

const mapDispatchToProps = {
  logout: appActions.logout
}

export default connect(mapStateToProps, mapDispatchToProps)(Menu)
