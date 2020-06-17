import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions } from '@core/rosters'
import { getRostersForCurrentLeague } from '@core/leagues'

import RostersPage from './rosters'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  (rosters) => ({ rosters })
)

const mapDispatchToProps = {
  load: rosterActions.loadRosters
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RostersPage)
