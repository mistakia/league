import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { scoreboardActions } from '@core/scoreboard'
import { getSelectedMatchup } from '@core/matchups'

import ScoreboardPage from './scoreboard'

const mapStateToProps = createSelector(
  getApp,
  getSelectedMatchup,
  (app, matchup) => ({ app, matchup })
)

const mapDispatchToProps = {
  load: scoreboardActions.load
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ScoreboardPage)
