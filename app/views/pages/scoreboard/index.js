import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedMatchup } from '@core/matchups'

import ScoreboardPage from './scoreboard'

const mapStateToProps = createSelector(getSelectedMatchup, (matchup) => ({
  matchup
}))

export default connect(mapStateToProps)(ScoreboardPage)
