import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import { get_current_league } from '@core/selectors'

import Lineup from './lineup'

const map_state_to_props = createSelector(get_current_league, (league) => ({
  league
}))

const map_dispatch_to_props = {
  update: roster_actions.update
}

export default connect(map_state_to_props, map_dispatch_to_props)(Lineup)
