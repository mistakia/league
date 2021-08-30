import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getRostersForCurrentLeague, rosterActions } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'

import RostersPage from './rosters'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getCurrentLeague,
  (rosters, league) => ({ rosters, league })
)

const mapDispatchToProps = {
  exportRosters: rosterActions.exportRosters
}

export default connect(mapStateToProps, mapDispatchToProps)(RostersPage)
