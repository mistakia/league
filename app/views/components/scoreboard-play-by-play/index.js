import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlaysByMatchupId } from '@core/selectors'

import ScoreboardPlayByPlay from './scoreboard-play-by-play'

const mapStateToProps = createSelector(getPlaysByMatchupId, (plays) => ({
  plays
}))

export default connect(mapStateToProps)(ScoreboardPlayByPlay)
