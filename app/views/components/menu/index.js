import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentTeam } from '@core/teams'

import Menu from './menu'

const mapStateToProps = createSelector(getApp, getCurrentTeam, (app, team) => ({
  isLoggedIn: Boolean(app.userId),
  team
}))

export default connect(mapStateToProps)(Menu)
