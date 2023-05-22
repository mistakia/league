import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/selectors'

import LeagueHeader from './league-header'

const mapStateToProps = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.getIn(['app', 'leagueIds']),
  getCurrentLeague,
  (leagueId, leagueIds, league) => ({
    league,
    is_in_league: leagueIds.includes(leagueId)
  })
)

export default connect(mapStateToProps)(LeagueHeader)
