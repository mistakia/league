import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'

import PlayerRoster from './player-roster'

const mapStateToProps = createSelector(
  getApp,
  (app) => ({ vbaseline: app.vbaseline })
)

export default connect(
  mapStateToProps
)(PlayerRoster)
