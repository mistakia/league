import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlaysByMatchupId } from '@core/selectors'

import ScoreboardPlayByPlay from './scoreboard-play-by-play'

const map_state_to_props = createSelector(getPlaysByMatchupId, (plays) => ({
  plays
}))

export default connect(map_state_to_props)(ScoreboardPlayByPlay)
