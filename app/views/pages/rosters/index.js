import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getRostersForCurrentLeague, rosterActions } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getTeamsForCurrentLeague } from '@core/teams'

import RostersPage from './rosters'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getCurrentLeague,
  getTeamsForCurrentLeague,
  (rosters, league, teams) => ({ rosters, league, teams })
)

const mapDispatchToProps = {
  exportRosters: rosterActions.exportRosters
}

export default connect(mapStateToProps, mapDispatchToProps)(RostersPage)
