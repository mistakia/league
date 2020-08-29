import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentMatchup } from '@core/matchups'

import ScoreboardPage from './scoreboard'

const mapStateToProps = createSelector(
  getApp,
  getCurrentMatchup,
  (app, matchup) => ({ app, matchup })
)

export default connect(
  mapStateToProps
)(ScoreboardPage)
