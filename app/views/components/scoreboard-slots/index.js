import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_current_league } from '@core/selectors'

import ScoreboardSlots from './scoreboard-slots'

const map_state_to_props = createSelector(get_current_league, (league) => ({
  league
}))

export default connect(map_state_to_props)(ScoreboardSlots)
