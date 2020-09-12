import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { scoreboardActions } from '@core/scoreboard'
import { getCurrentMatchup, getSelectedMatchup } from '@core/matchups'

import ScoreboardPage from './scoreboard'

const mapStateToProps = createSelector(
  getApp,
  getCurrentMatchup,
  getSelectedMatchup,
  (app, matchup, selected) => ({ app, matchup, selected })
)

const mapDispatchToProps = {
  load: scoreboardActions.load
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ScoreboardPage)
