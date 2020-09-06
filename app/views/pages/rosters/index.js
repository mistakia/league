import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getRostersForCurrentLeague } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'

import RostersPage from './rosters'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getCurrentLeague,
  (rosters, league) => ({ rosters, league })
)

export default connect(
  mapStateToProps
)(RostersPage)
