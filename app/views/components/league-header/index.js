import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_current_league } from '@core/selectors'

import LeagueHeader from './league-header'

const map_state_to_props = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.getIn(['app', 'leagueIds']),
  get_current_league,
  (leagueId, leagueIds, league) => ({
    league,
    is_in_league: leagueIds.includes(leagueId)
  })
)

export default connect(map_state_to_props)(LeagueHeader)
