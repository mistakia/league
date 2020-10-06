import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getSelectedMatchup } from '@core/matchups'

import ScoreboardPage from './scoreboard'

const mapStateToProps = createSelector(
  getApp,
  getSelectedMatchup,
  (app, matchup) => ({ app, matchup })
)

export default connect(
  mapStateToProps
)(ScoreboardPage)
