import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_current_league } from '@core/selectors'

import PageHead from './page-head'

const map_state_to_props = createSelector(get_current_league, (league) => ({
  league_name: league.name || undefined
}))

export default connect(map_state_to_props)(PageHead)
