import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'

import Player from './player'

const mapStateToProps = createSelector(
  getApp,
  (app) => ({ vbaseline: app.vbaseline })
)

export default connect(
  mapStateToProps
)(Player)
