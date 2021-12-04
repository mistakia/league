import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { withRouter } from 'react-router-dom'

import { getApp } from '@core/app'
import { getCurrentTeam } from '@core/teams'

import Menu from './menu'

const mapStateToProps = createSelector(getApp, getCurrentTeam, (app, team) => ({
  isLoggedIn: Boolean(app.userId),
  team
}))

export default withRouter(connect(mapStateToProps)(Menu))
