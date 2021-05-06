import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'

import ScoreboardSlots from './scoreboard-slots'

const mapStateToProps = createSelector(getCurrentLeague, (league) => ({
  league
}))

export default connect(mapStateToProps)(ScoreboardSlots)
